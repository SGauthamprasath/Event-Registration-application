// index.js - the API, now backed by Supabase Postgres. Each route does cheap checks
// first and relies on database constraints for the final word on duplicates.
require('dotenv').config();
const crypto = require('crypto');

for (const k of ['QR_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[k]) {
    console.error(`Missing ${k}. See .env.example.`);
    process.exit(1);
  }
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const supabase = require('./supabase');
const auth = require('./auth');
const { getStatus, attendanceOpen, registrationOpen } = require('./status');
const { checkToken, currentToken } = require('./qr');

const app = express();
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));
app.use(express.json({ limit: '50kb' }));
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
  : true;
app.use(cors({ origin: corsOrigin, credentials: false }));

const { requireUser, requireTeacher, requireProfile } = auth;
const asyncSafe = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const UNIQUE_VIOLATION = '23505';

// ---------- config ----------
app.get('/api/config', (req, res) => {
  res.json({ domain: auth.DOMAIN, supabaseUrl: process.env.SUPABASE_URL, staticCode: !!staticCode() });
});

// ---------- quick login ----------
// A student who has verified by email once (and finished their profile) can sign in again with
// just their email: the server mints a one-time sign-in token via the admin API (no email sent)
// and the client exchanges it for a session. This trades security for fewer emails: anyone who
// knows a verified student's email can sign in as them. Teachers (admins) who have signed in
// once get the same shortcut, so anyone who knows a teacher email gets the control room.
// Turn it off with QUICK_LOGIN=0 (everyone) or TEACHER_QUICK_LOGIN=0 (teachers only).
const quickLoginOn = () => process.env.QUICK_LOGIN !== '0';
const teacherQuickLoginOn = () => process.env.TEACHER_QUICK_LOGIN !== '0';
const quickLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 10,
  keyGenerator: (req) => String(req.body?.email || '').trim().toLowerCase() || ipKeyGenerator(req),
  message: { error: 'Too many attempts. Wait a few minutes.' },
  standardHeaders: true, legacyHeaders: false,
});

app.post('/api/quick-login', quickLimiter, asyncSafe(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const no = () => res.json({ token_hash: null }); // client falls back to the emailed code
  if (!quickLoginOn() || !auth.isCollegeEmail(email)) return no();
  const teacher = auth.isTeacher(email);
  if (teacher && !teacherQuickLoginOn()) return no();
  const profile = await auth.loadProfile(email);
  // Teachers don't fill the student profile form; a profile row is enough to start with.
  if (teacher ? !profile : !auth.profileComplete(profile)) return no();
  const { data, error } = await supabase.auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !data?.properties?.hashed_token) return no();
  // "Verified before" for a teacher = has actually signed in with an emailed code at least once.
  if (teacher && !data.user?.last_sign_in_at) return no();
  res.json({ token_hash: data.properties.hashed_token });
}));

// ---------- shared sign-in code ----------
// While login emails are unreliable, first-time students sign in with one code announced in the
// hall (STATIC_LOGIN_CODE) instead of an emailed one. Unset it and the emailed code is back.
// Teachers never use it.
const staticCode = () => (process.env.STATIC_LOGIN_CODE || '').trim();
const sameCode = (a, b) => {
  const x = crypto.createHash('sha256').update(a).digest();
  const y = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(x, y);
};

app.post('/api/code-login', quickLimiter, asyncSafe(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();
  const expected = staticCode();
  if (!expected || !auth.isCollegeEmail(email) || auth.isTeacher(email)) return res.status(403).json({ error: 'Use the code from your email' });
  if (!sameCode(code, expected)) return res.status(400).json({ error: 'Wrong code' }); // not 401: the client treats 401 as an expired session
  // New students get an already-confirmed account; existing ones just get a fresh sign-in token.
  const { error: createErr } = await supabase.auth.admin.createUser({ email, email_confirm: true });
  if (createErr && !/already/i.test(createErr.message)) throw createErr;
  const { data, error } = await supabase.auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !data?.properties?.hashed_token) throw error || new Error('no token');
  res.json({ token_hash: data.properties.hashed_token });
}));

// ---------- profile ----------
app.get('/api/me', requireUser, (req, res) => {
  res.json({ user: auth.publicUser(req.user, req.user.role) });
});

app.put('/api/me', requireUser, asyncSafe(async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 100);
  const department = String(req.body.department || '').trim().slice(0, 100);
  const year = Number(req.body.year);
  const roll_no = String(req.body.roll_no || '').trim().toUpperCase().replace(/\s+/g, '').slice(0, 30);

  if (!name || !department || !roll_no || !Number.isInteger(year) || year < 1 || year > 5)
    return res.status(400).json({ error: 'Name, department, year (1-5) and roll number are required' });

  const { data, error } = await supabase.from('profiles')
    .update({ name, department, year, roll_no })
    .eq('email', req.user.email)
    .select().maybeSingle();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return res.status(409).json({ error: 'That roll number is already used by another account' });
    throw error;
  }
  if (data) auth.setCachedProfile(data);
  res.json({ user: auth.publicUser(data || req.user, req.user.role) });
}));

// ---------- events ----------
const isHttpUrl = (s) => { try { return ['http:', 'https:'].includes(new URL(s).protocol); } catch { return false; } };

function parseEventBody(b) {
  const title = String(b.title || '').trim().slice(0, 200);
  const description = String(b.description || '').trim().slice(0, 2000);
  const venue = String(b.venue || '').trim().slice(0, 200);
  const brochure_url = String(b.brochure_url || '').trim();
  const valid = (v) => v && !Number.isNaN(Date.parse(v));
  if (!title) return { error: 'Title is required' };
  if (!valid(b.starts_at) || !valid(b.ends_at)) return { error: 'Valid start and end times are required' };
  if (Date.parse(b.ends_at) <= Date.parse(b.starts_at)) return { error: 'End time must be after start time' };
  if (brochure_url && !isHttpUrl(brochure_url) && !brochure_url.startsWith('/')) return { error: 'Brochure must be an http(s) link or a /path' };
  let closes = null;
  if (b.attendance_closes_at) {
    if (!valid(b.attendance_closes_at)) return { error: 'Invalid attendance close time' };
    if (Date.parse(b.attendance_closes_at) <= Date.parse(b.starts_at)) return { error: 'Attendance close must be after start' };
    closes = new Date(b.attendance_closes_at).toISOString();
  }
  return {
    value: {
      title, description, venue, brochure_url: brochure_url || null,
      starts_at: new Date(b.starts_at).toISOString(),
      ends_at: new Date(b.ends_at).toISOString(),
      attendance_closes_at: closes,
    },
  };
}

// Events + per-event counts are the same for every user, so they are loaded once and shared
// for SNAPSHOT_MS instead of once per request (180 phones polling). Concurrent callers share one
// in-flight load. Teacher edits drop the snapshot at once; counts may lag by up to SNAPSHOT_MS.
// Counts use count queries: selecting every row stops at Supabase's 1000-row limit.
const SNAPSHOT_MS = 5000;
let snapshot = null; // { at, promise }

async function loadSnapshot() {
  const { data: events, error } = await supabase.from('events').select('*').order('starts_at');
  if (error) throw error;
  const count = (table, id) => supabase.from(table).select('*', { count: 'exact', head: true }).eq('event_id', id)
    .then(({ count: n, error: e }) => { if (e) throw e; return n || 0; });
  const counts = await Promise.all(events.map((e) => Promise.all([count('registrations', e.id), count('attendance', e.id)])));
  const regCount = new Map(), attCount = new Map();
  events.forEach((e, i) => { regCount.set(e.id, counts[i][0]); attCount.set(e.id, counts[i][1]); });
  return { events, regCount, attCount };
}

function getSnapshot() {
  if (!snapshot || Date.now() - snapshot.at > SNAPSHOT_MS) {
    const promise = loadSnapshot();
    snapshot = { at: Date.now(), promise };
    promise.catch(() => { if (snapshot?.promise === promise) snapshot = null; });
  }
  return snapshot.promise;
}
const dropSnapshot = () => { snapshot = null; };

async function getEvent(id) {
  const { events } = await getSnapshot();
  return events.find((e) => e.id === Number(id)) || null;
}

app.get('/api/events', requireUser, asyncSafe(async (req, res) => {
  const now = Date.now();
  const email = req.user.email;
  const [{ events, regCount, attCount }, { data: mineReg = [] }, { data: mineAttend = [] }] = await Promise.all([
    getSnapshot(),
    supabase.from('registrations').select('event_id').eq('email', email),
    supabase.from('attendance').select('event_id').eq('email', email),
  ]);
  const regSet = new Set(mineReg.map((r) => r.event_id));
  const attSet = new Set(mineAttend.map((r) => r.event_id));

  res.json({
    serverTime: now,
    events: events.map((e) => ({
      ...e,
      registered: regSet.has(e.id),
      attended: attSet.has(e.id),
      registered_count: regCount.get(e.id) || 0,
      checked_in: attCount.get(e.id) || 0,
      status: getStatus(e, now),
      attendance_open: attendanceOpen(e, now),
      registration_open: registrationOpen(e, now),
    })),
  });
}));

app.post('/api/events', requireTeacher, asyncSafe(async (req, res) => {
  const { value, error } = parseEventBody(req.body);
  if (error) return res.status(400).json({ error });
  const { data, error: dbErr } = await supabase.from('events').insert(value).select('id').single();
  if (dbErr) throw dbErr;
  dropSnapshot();
  res.json({ id: data.id });
}));

app.put('/api/events/:id', requireTeacher, asyncSafe(async (req, res) => {
  const { value, error } = parseEventBody(req.body);
  if (error) return res.status(400).json({ error });
  const { data, error: dbErr } = await supabase.from('events').update(value).eq('id', Number(req.params.id)).select('id').maybeSingle();
  if (dbErr) throw dbErr;
  dropSnapshot();
  if (!data) return res.status(404).json({ error: 'Event not found' });
  res.json({ ok: true });
}));

// Control-room override: open or close attendance right now, whatever the schedule says.
app.post('/api/events/:id/attendance', requireTeacher, asyncSafe(async (req, res) => {
  const ev = await getEvent(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found' });
  const now = Date.now();
  let patch;
  if (req.body.open) {
    // After the scheduled close (or a manual one), keep it open for 30 minutes; close it again any time.
    const closesLater = Date.parse(ev.attendance_closes_at || ev.ends_at) > now + 60_000;
    patch = {
      attendance_opens_at: new Date(now).toISOString(),
      attendance_closes_at: closesLater ? ev.attendance_closes_at : new Date(now + 30 * 60_000).toISOString(),
    };
  } else if (now < Date.parse(ev.starts_at)) {
    // Closing before the start just undoes an early open; attendance opens on schedule again.
    patch = { attendance_opens_at: null, attendance_closes_at: null };
  } else {
    patch = { attendance_closes_at: new Date(now).toISOString() };
  }
  const { error } = await supabase.from('events').update(patch).eq('id', ev.id);
  if (error) throw error;
  dropSnapshot();
  res.json({ attendance_open: attendanceOpen({ ...ev, ...patch }, now) });
}));

// Control-room switch for registration (it is otherwise open until the event ends). Works on any
// event, so a teacher can also reopen one that has already ended.
app.post('/api/events/:id/registration', requireTeacher, asyncSafe(async (req, res) => {
  const ev = await getEvent(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found' });
  const patch = { registration_override: !!req.body.open };
  const { error } = await supabase.from('events').update(patch).eq('id', ev.id);
  if (error) throw error;
  dropSnapshot();
  res.json({ registration_open: registrationOpen({ ...ev, ...patch }) });
}));

app.delete('/api/events/:id', requireTeacher, asyncSafe(async (req, res) => {
  const { error } = await supabase.from('events').delete().eq('id', Number(req.params.id));
  if (error) throw error;
  dropSnapshot();
  res.json({ ok: true });
}));

// ---------- registration ----------
app.post('/api/events/:id/register', requireUser, requireProfile, asyncSafe(async (req, res) => {
  const ev = await getEvent(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found' });
  if (!registrationOpen(ev)) return res.status(403).json({ error: 'Registration is closed' });
  const { error } = await supabase.from('registrations').insert({ event_id: ev.id, email: req.user.email });
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return res.status(409).json({ error: 'Already registered' });
    throw error;
  }
  res.json({ status: 'registered' });
}));

// ---------- rotating QR ----------
app.get('/api/events/:id/qr', requireTeacher, asyncSafe(async (req, res) => {
  const ev = await getEvent(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found' });
  if (!attendanceOpen(ev)) return res.status(403).json({ status: 'closed' });
  res.json(currentToken(ev.id));
}));

// ---------- attendance (scan) ----------
const attendLimiter = rateLimit({
  windowMs: 60_000,
  limit: 12,
  keyGenerator: (req) => req.user?.email || ipKeyGenerator(req),
  message: { status: 'too_many_attempts' },
  standardHeaders: true, legacyHeaders: false,
});

app.post('/api/events/:id/attend', requireUser, requireProfile, attendLimiter, asyncSafe(async (req, res) => {
  const ev = await getEvent(req.params.id);
  if (!ev) return res.status(404).json({ status: 'not_found' });

  const now = Date.now();
  if (!attendanceOpen(ev, now)) return res.status(403).json({ status: getStatus(ev, now) === 'upcoming' ? 'not_started' : 'closed' });

  const { token, deviceId } = req.body;
  if (typeof deviceId !== 'string' || deviceId.length < 8 || deviceId.length > 100)
    return res.status(400).json({ status: 'bad_request' });
  const tokenStatus = checkToken(ev.id, token);
  if (tokenStatus !== 'ok') return res.status(400).json({ status: tokenStatus });

  const { data: reg } = await supabase.from('registrations').select('email').eq('event_id', ev.id).eq('email', req.user.email).maybeSingle();
  if (!reg) return res.status(403).json({ status: 'not_registered' });

  // Insert straight away; on a unique violation, look up whether it was my own earlier scan.
  const alreadyMine = async () => {
    const { data } = await supabase.from('attendance').select('email').eq('event_id', ev.id).eq('email', req.user.email).maybeSingle();
    return !!data;
  };

  const { error } = await supabase.from('attendance').insert({
    event_id: ev.id,
    email: req.user.email,
    device_id: deviceId,
    ip: req.ip,
    user_agent: (req.get('user-agent') || '').slice(0, 300),
    method: 'scan',
  });
  if (!error) return res.json({ status: 'marked' });
  if (error.code !== UNIQUE_VIOLATION) throw error;
  // Either my own row (duplicate) or the (event_id, device_id) partial unique index (device_used).
  const mine = await alreadyMine();
  return res.status(mine ? 200 : 403).json({ status: mine ? 'duplicate' : 'device_used' });
}));

// ---------- teacher tools ----------
async function eventStats(eventId) {
  const [{ count: registered = 0 }, { count: attended = 0 }] = await Promise.all([
    supabase.from('registrations').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
    supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
  ]);
  return { registered, attended, absent: Math.max(0, registered - attended), byYear: await yearBreakdown(eventId) };
}

// Registered / attended per year of study, for the control room's year-wise table.
async function yearBreakdown(eventId) {
  const [{ data: regs = [] }, { data: atts = [] }] = await Promise.all([
    supabase.from('registrations').select('email, profiles!inner(year)').eq('event_id', eventId),
    supabase.from('attendance').select('email').eq('event_id', eventId),
  ]);
  const present = new Set(atts.map((a) => a.email));
  const rows = new Map();
  for (const r of regs) {
    const year = r.profiles?.year || 0; // 0 = profile without a year
    const row = rows.get(year) || { year, registered: 0, attended: 0 };
    row.registered++;
    if (present.has(r.email)) row.attended++;
    rows.set(year, row);
  }
  return [...rows.values()].sort((a, b) => a.year - b.year);
}

app.get('/api/events/:id/stats', requireTeacher, asyncSafe(async (req, res) => {
  const ev = await getEvent(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found' });
  res.json(await eventStats(ev.id));
}));

app.post('/api/events/:id/manual', requireTeacher, asyncSafe(async (req, res) => {
  const ev = await getEvent(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found' });
  if (getStatus(ev) === 'upcoming' && !attendanceOpen(ev)) return res.status(403).json({ error: 'Event has not started' });

  const roll = String(req.body.roll_no || '').trim().toUpperCase().replace(/\s+/g, '');
  const { data: profile } = await supabase.from('profiles').select('email, name, roll_no').eq('roll_no', roll).maybeSingle();
  if (!profile) return res.status(404).json({ status: 'not_registered', roll_no: roll });

  const { data: reg } = await supabase.from('registrations').select('email').eq('event_id', ev.id).eq('email', profile.email).maybeSingle();
  if (!reg) return res.status(404).json({ status: 'not_registered', roll_no: roll });

  const { error } = await supabase.from('attendance').insert({
    event_id: ev.id, email: profile.email, method: 'manual', ip: req.ip,
  });
  if (error && error.code !== UNIQUE_VIOLATION) throw error;
  res.json({ status: error ? 'duplicate' : 'marked', student: { name: profile.name, roll_no: profile.roll_no } });
}));

// ---------- CSV helpers ----------
const csvCell = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const istTime = (iso) => iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '';

app.get('/api/events/:id/export.csv', requireTeacher, asyncSafe(async (req, res) => {
  const ev = await getEvent(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found' });

  const { data: regs = [] } = await supabase
    .from('registrations')
    .select('registered_at, email, profiles!inner(email, name, department, year, roll_no)')
    .eq('event_id', ev.id);
  // ?year=2 limits the sheet to one year of study.
  const year = Number(req.query.year) || null;
  const { data: atts = [] } = await supabase.from('attendance').select('email, marked_at, method').eq('event_id', ev.id);
  const attByEmail = new Map(atts.map((a) => [a.email, a]));

  const rows = regs
    .map((r) => ({
      roll_no: r.profiles?.roll_no, name: r.profiles?.name, department: r.profiles?.department,
      year: r.profiles?.year, email: r.email, registered_at: r.registered_at,
      att: attByEmail.get(r.email),
    }))
    .filter((r) => !year || r.year === year)
    .sort((a, b) => String(a.roll_no || '').localeCompare(String(b.roll_no || '')));

  const header = ['Roll No', 'Name', 'Department', 'Year', 'Email', 'Registered At (IST)', 'Status', 'Marked At (IST)', 'Method'];
  const lines = [header.map(csvCell).join(',')];
  for (const r of rows) {
    lines.push([
      r.roll_no, r.name, r.department, r.year, r.email, istTime(r.registered_at),
      r.att ? 'Attended' : 'Absent', istTime(r.att?.marked_at), r.att?.method || '',
    ].map(csvCell).join(','));
  }

  const safeName = ev.title.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').slice(0, 50) || 'event';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}${year ? `_year${year}` : ''}_attendance.csv"`);
  res.send('﻿' + lines.join('\r\n'));
}));

// ---------- admin ----------
app.get('/api/admin/overview', requireTeacher, asyncSafe(async (req, res) => {
  const [{ events, regCount, attCount }, { count: totalStudents = 0 }, { data: profiles = [] }] = await Promise.all([
    getSnapshot(),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('department'),
  ]);
  const sum = (m) => [...m.values()].reduce((a, b) => a + b, 0);
  const byDeptMap = new Map();
  for (const p of profiles) {
    const d = p.department || 'Unspecified';
    byDeptMap.set(d, (byDeptMap.get(d) || 0) + 1);
  }
  res.json({
    events: events.map((e) => ({ id: e.id, title: e.title, venue: e.venue, starts_at: e.starts_at, ends_at: e.ends_at, registered: regCount.get(e.id) || 0, attended: attCount.get(e.id) || 0 })),
    totalStudents,
    totalRegistrations: sum(regCount),
    totalAttendances: sum(attCount),
    byDept: [...byDeptMap.entries()].map(([department, n]) => ({ department, n })).sort((a, b) => b.n - a.n),
  });
}));

app.get('/api/admin/students', requireTeacher, asyncSafe(async (req, res) => {
  const [{ data: profiles = [] }, { data: regs = [] }, { data: atts = [] }] = await Promise.all([
    supabase.from('profiles').select('*').order('name'),
    supabase.from('registrations').select('email'),
    supabase.from('attendance').select('email'),
  ]);
  const regBy = new Map(); for (const r of regs) regBy.set(r.email, (regBy.get(r.email) || 0) + 1);
  const attBy = new Map(); for (const r of atts) attBy.set(r.email, (attBy.get(r.email) || 0) + 1);
  res.json({
    students: profiles.map((p) => ({
      email: p.email, name: p.name, department: p.department, year: p.year, roll_no: p.roll_no,
      created_at: p.created_at,
      registrations: regBy.get(p.email) || 0,
      attendances: attBy.get(p.email) || 0,
    })),
  });
}));

app.get('/api/admin/students.csv', requireTeacher, asyncSafe(async (req, res) => {
  const [{ data: profiles = [] }, { data: regs = [] }, { data: atts = [] }] = await Promise.all([
    supabase.from('profiles').select('*').order('name'),
    supabase.from('registrations').select('email'),
    supabase.from('attendance').select('email'),
  ]);
  const regBy = new Map(); for (const r of regs) regBy.set(r.email, (regBy.get(r.email) || 0) + 1);
  const attBy = new Map(); for (const r of atts) attBy.set(r.email, (attBy.get(r.email) || 0) + 1);

  const header = ['Roll No', 'Name', 'Department', 'Year', 'Email', 'Signed Up (IST)', 'Registrations', 'Attendances'];
  const lines = [header.map(csvCell).join(',')];
  for (const p of profiles) {
    lines.push([
      p.roll_no || '', p.name || '', p.department || '', p.year || '', p.email,
      istTime(p.created_at), regBy.get(p.email) || 0, attBy.get(p.email) || 0,
    ].map(csvCell).join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="all_students.csv"');
  res.send('﻿' + lines.join('\r\n'));
}));

// ---------- serve built React (single deployable) ----------
const dist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

const PORT = Number(process.env.PORT || 4000);
if (require.main === module) app.listen(PORT, () => console.log(`Campus Events API on :${PORT}`));
module.exports = app;
