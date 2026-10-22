// index.js - the API. Each route does its checks cheapest-first and lets the
// database constraints be the final word on duplicates.
require('dotenv').config();

for (const k of ['JWT_SECRET', 'QR_SECRET']) {
  if (!process.env[k] || process.env[k].length < 16) {
    console.error(`Missing or too-short ${k}. Copy .env.example to .env and set it (16+ characters).`);
    process.exit(1);
  }
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const db = require('./db');
const auth = require('./auth');
const otp = require('./otp');
const { getStatus, attendanceOpen } = require('./status');
const { isValidToken, currentToken } = require('./qr');

const app = express();
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1)); // so req.ip is the real client behind Render/Railway
app.use(express.json({ limit: '50kb' }));
app.use(cors());

const { requireUser, requireTeacher, requireProfile } = auth;
const asyncSafe = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- config + login ----------
app.get('/api/config', (req, res) => {
  res.json({
    domain: auth.DOMAIN,
    devLogin: auth.devLoginEnabled(),
  });
});

const normEmail = (b) => String(b.email || '').trim().toLowerCase();

function sendSession(res, email) {
  const token = auth.issueSession(email);
  const user = { ...db.prepare('SELECT * FROM users WHERE email = ?').get(email),
                 role: auth.isTeacher(email) ? 'teacher' : 'student' };
  res.json({ token, user: auth.publicUser(user) });
}

// Caps code requests per IP on top of the per-email resend cooldown in otp.js.
const otpLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  message: { error: 'Too many requests. Try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/api/auth/otp/request', otpLimiter, asyncSafe(async (req, res) => {
  const email = normEmail(req.body);
  if (!auth.isCollegeEmail(email)) return res.status(400).json({ error: 'Use your @' + auth.DOMAIN + ' email' });
  try {
    const { retryAfter } = await otp.requestOtp(email);
    if (retryAfter) return res.status(429).json({ error: `Wait ${retryAfter}s before asking for another code`, retryAfter });
    res.json({ ok: true });
  } catch (e) {
    console.error('[otp] send failed:', e.message);
    res.status(502).json({ error: 'Could not send the email. Try again shortly.' });
  }
}));

app.post('/api/auth/otp/verify', otpLimiter, (req, res) => {
  const email = normEmail(req.body);
  if (!auth.isCollegeEmail(email)) return res.status(400).json({ error: 'Use your @' + auth.DOMAIN + ' email' });
  try {
    otp.verifyOtp(email, req.body.code);
  } catch (e) {
    return res.status(401).json({ error: e.message });
  }
  sendSession(res, email);
});

// Local testing only. Disabled unless DEV_LOGIN=1 and NODE_ENV is not "production".
app.post('/api/auth/dev', (req, res) => {
  if (!auth.devLoginEnabled()) return res.status(404).json({ error: 'Not found' });
  const email = normEmail(req.body);
  if (!auth.isCollegeEmail(email)) return res.status(401).json({ error: 'Use a @' + auth.DOMAIN + ' email' });
  sendSession(res, email);
});

// ---------- profile ----------
app.get('/api/me', requireUser, (req, res) => res.json({ user: auth.publicUser(req.user) }));

app.put('/api/me', requireUser, (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 100);
  const department = String(req.body.department || '').trim().slice(0, 100);
  const year = Number(req.body.year);
  const roll_no = String(req.body.roll_no || '').trim().toUpperCase().replace(/\s+/g, '').slice(0, 30);

  if (!name || !department || !roll_no || !Number.isInteger(year) || year < 1 || year > 5)
    return res.status(400).json({ error: 'Name, department, year (1-5) and roll number are required' });

  try {
    db.prepare('UPDATE users SET name=?, department=?, year=?, roll_no=? WHERE email=?')
      .run(name, department, year, roll_no, req.user.email);
  } catch (e) {
    if (String(e.code).startsWith('SQLITE_CONSTRAINT'))
      return res.status(409).json({ error: 'That roll number is already used by another account' });
    throw e;
  }
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(req.user.email);
  res.json({ user: auth.publicUser({ ...row, role: req.user.role }) });
});

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

app.get('/api/events', requireUser, (req, res) => {
  const now = Date.now();
  const rows = db.prepare(`
    SELECT e.*,
      EXISTS (SELECT 1 FROM registrations r WHERE r.event_id = e.id AND r.email = ?) AS registered,
      EXISTS (SELECT 1 FROM attendance a WHERE a.event_id = e.id AND a.email = ?)    AS attended,
      (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id)                 AS registered_count,
      (SELECT COUNT(*) FROM attendance a WHERE a.event_id = e.id)                    AS checked_in
    FROM events e
    ORDER BY e.starts_at
  `).all(req.user.email, req.user.email);

  res.json({
    serverTime: now, // lets phones with a wrong clock stay in sync
    events: rows.map((e) => ({
      ...e,
      registered: !!e.registered,
      attended: !!e.attended,
      status: getStatus(e, now),
      attendance_open: attendanceOpen(e, now),
    })),
  });
});

app.post('/api/events', requireTeacher, (req, res) => {
  const { value, error } = parseEventBody(req.body);
  if (error) return res.status(400).json({ error });
  const r = db.prepare(`
    INSERT INTO events (title, description, brochure_url, venue, starts_at, ends_at, attendance_closes_at)
    VALUES (@title, @description, @brochure_url, @venue, @starts_at, @ends_at, @attendance_closes_at)
  `).run(value);
  res.json({ id: r.lastInsertRowid });
});

// Editing times is how a teacher ends early or extends; status follows automatically.
app.put('/api/events/:id', requireTeacher, (req, res) => {
  const { value, error } = parseEventBody(req.body);
  if (error) return res.status(400).json({ error });
  const r = db.prepare(`
    UPDATE events SET title=@title, description=@description, brochure_url=@brochure_url, venue=@venue,
      starts_at=@starts_at, ends_at=@ends_at, attendance_closes_at=@attendance_closes_at
    WHERE id=@id
  `).run({ ...value, id: Number(req.params.id) });
  if (!r.changes) return res.status(404).json({ error: 'Event not found' });
  res.json({ ok: true });
});

const getEvent = (id) => db.prepare('SELECT * FROM events WHERE id = ?').get(Number(id));

// ---------- registration ----------
app.post('/api/events/:id/register', requireUser, requireProfile, (req, res) => {
  const ev = getEvent(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found' });
  if (getStatus(ev) !== 'upcoming') return res.status(403).json({ error: 'Registration is closed' });
  try {
    db.prepare('INSERT INTO registrations (event_id, email) VALUES (?, ?)').run(ev.id, req.user.email);
    res.json({ status: 'registered' });
  } catch (e) {
    if (String(e.code).startsWith('SQLITE_CONSTRAINT'))
      return res.status(409).json({ error: 'Already registered' });
    throw e;
  }
});

// ---------- rotating QR (teacher's projector page polls this) ----------
app.get('/api/events/:id/qr', requireTeacher, (req, res) => {
  const ev = getEvent(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found' });
  if (!attendanceOpen(ev)) return res.status(403).json({ status: 'closed' });
  res.json(currentToken(ev.id));
});

// ---------- attendance (student scans the projected QR) ----------
const attendLimiter = rateLimit({
  windowMs: 60_000,
  limit: 12,                                  // 12 tries per minute per student
  keyGenerator: (req) => req.user.email,
  message: { status: 'too_many_attempts' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/api/events/:id/attend', requireUser, requireProfile, attendLimiter, (req, res) => {
  const ev = getEvent(req.params.id);
  if (!ev) return res.status(404).json({ status: 'not_found' });

  const now = Date.now();
  if (getStatus(ev, now) === 'upcoming') return res.status(403).json({ status: 'not_started' });
  if (!attendanceOpen(ev, now)) return res.status(403).json({ status: 'closed' });

  const { token, deviceId } = req.body;
  if (typeof deviceId !== 'string' || deviceId.length < 8 || deviceId.length > 100)
    return res.status(400).json({ status: 'bad_request' });
  if (!isValidToken(ev.id, token)) return res.status(400).json({ status: 'expired' });

  const reg = db.prepare('SELECT 1 FROM registrations WHERE event_id=? AND email=?').get(ev.id, req.user.email);
  if (!reg) return res.status(403).json({ status: 'not_registered' });

  const already = () => db.prepare('SELECT 1 FROM attendance WHERE event_id=? AND email=?').get(ev.id, req.user.email);
  if (already()) return res.json({ status: 'duplicate' });

  try {
    db.prepare(`INSERT INTO attendance (event_id, email, device_id, ip, user_agent, method)
                VALUES (?, ?, ?, ?, ?, 'scan')`)
      .run(ev.id, req.user.email, deviceId, req.ip, (req.get('user-agent') || '').slice(0, 300));
    res.json({ status: 'marked' });
  } catch (e) {
    if (!String(e.code).startsWith('SQLITE_CONSTRAINT')) throw e;
    // Either a double-tap race on the same student, or this phone already marked someone else.
    return res.status(already() ? 200 : 403).json({ status: already() ? 'duplicate' : 'device_used' });
  }
});

// ---------- teacher tools ----------
function eventStats(eventId) {
  const registered = db.prepare('SELECT COUNT(*) c FROM registrations WHERE event_id=?').get(eventId).c;
  const attended = db.prepare('SELECT COUNT(*) c FROM attendance WHERE event_id=?').get(eventId).c;
  return { registered, attended, absent: registered - attended };
}

app.get('/api/events/:id/stats', requireTeacher, (req, res) => {
  const ev = getEvent(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found' });
  res.json(eventStats(ev.id));
});

app.post('/api/events/:id/manual', requireTeacher, (req, res) => {
  const ev = getEvent(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found' });
  if (getStatus(ev) === 'upcoming') return res.status(403).json({ error: 'Event has not started' });

  const roll = String(req.body.roll_no || '').trim().toUpperCase().replace(/\s+/g, '');
  const student = db.prepare(`
    SELECT u.email, u.name, u.roll_no FROM registrations r
    JOIN users u ON u.email = r.email
    WHERE r.event_id = ? AND u.roll_no = ?
  `).get(ev.id, roll);
  if (!student) return res.status(404).json({ status: 'not_registered', roll_no: roll });

  const r = db.prepare(`INSERT OR IGNORE INTO attendance (event_id, email, method, ip) VALUES (?, ?, 'manual', ?)`)
    .run(ev.id, student.email, req.ip);
  res.json({ status: r.changes ? 'marked' : 'duplicate', student: { name: student.name, roll_no: student.roll_no } });
});

// CSV cells starting with = + - @ are executed as formulas by Excel, so neutralise them.
const csvCell = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const istTime = (sqliteUtc) =>
  sqliteUtc
    ? new Date(sqliteUtc.replace(' ', 'T') + 'Z').toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    : '';

app.get('/api/events/:id/export.csv', requireTeacher, (req, res) => {
  const ev = getEvent(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found' });

  // LEFT JOIN: every registered student appears once; no attendance row means Absent.
  const rows = db.prepare(`
    SELECT u.roll_no, u.name, u.department, u.year, u.email,
           r.registered_at, a.marked_at, a.method
    FROM registrations r
    JOIN users u ON u.email = r.email
    LEFT JOIN attendance a ON a.event_id = r.event_id AND a.email = r.email
    WHERE r.event_id = ?
    ORDER BY u.roll_no
  `).all(ev.id);

  const header = ['Roll No', 'Name', 'Department', 'Year', 'Email', 'Registered At (IST)', 'Status', 'Marked At (IST)', 'Method'];
  const lines = [header.map(csvCell).join(',')];
  for (const r of rows) {
    lines.push([
      r.roll_no, r.name, r.department, r.year, r.email, istTime(r.registered_at),
      r.marked_at ? 'Attended' : 'Absent', istTime(r.marked_at), r.method || '',
    ].map(csvCell).join(','));
  }

  const safeName = ev.title.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').slice(0, 50) || 'event';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}_attendance.csv"`);
  res.send('﻿' + lines.join('\r\n')); // BOM so Excel opens it as UTF-8
});

// ---------- serve the built React app (single deployable) ----------
const dist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {            // last-resort error handler: never leak internals
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

const PORT = Number(process.env.PORT || 4000);
if (require.main === module) app.listen(PORT, () => console.log(`Campus Events API on :${PORT}`));
module.exports = app;
