// auth.js - validates Supabase-issued JWTs and loads the profile.
// Login flow (OTP email) lives entirely on the client via @supabase/supabase-js.
// Role is derived every request from the TEACHER_EMAILS env list, never the token.
const supabase = require('./supabase');

const DOMAIN = (process.env.COLLEGE_DOMAIN || 'psgitech.ac.in').toLowerCase();
const teacherList = () =>
  (process.env.TEACHER_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

const isCollegeEmail = (email) =>
  typeof email === 'string' && email.toLowerCase().endsWith('@' + DOMAIN);

const isTeacher = (email) => teacherList().includes((email || '').toLowerCase());

const profileComplete = (p) => !!(p && p.name && p.department && p.year && p.roll_no);

function publicUser(p, role) {
  return {
    email: p.email, name: p.name, department: p.department, year: p.year,
    roll_no: p.roll_no, role, profileComplete: profileComplete(p),
  };
}

// Supabase sits ~250 ms away, and every request used to pay two round trips (token check +
// profile) before doing any work. Both are cached in memory: a token until shortly before it
// expires (at most 5 min), a profile for 60 s or until PUT /api/me changes it.
const TOKEN_TTL_MS = 5 * 60_000;
const PROFILE_TTL_MS = 60_000;
const tokenCache = new Map();   // token -> { user, until }
const profileCache = new Map(); // email -> { profile, until }

function prune(map, now) {
  if (map.size < 5000) return;
  for (const [k, v] of map) if (v.until <= now) map.delete(k);
}

async function verifyToken(token) {
  const now = Date.now();
  const hit = tokenCache.get(token);
  if (hit && hit.until > now) return hit.user;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user?.email) throw new Error('invalid token');
  let exp = now + TOKEN_TTL_MS;
  try { exp = JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).exp * 1000 - 30_000; } catch {}
  prune(tokenCache, now);
  tokenCache.set(token, { user, until: Math.min(exp, now + TOKEN_TTL_MS) });
  return user;
}

async function loadProfile(email) {
  const now = Date.now();
  const hit = profileCache.get(email);
  if (hit && hit.until > now) return hit.profile;
  const { data } = await supabase.from('profiles').select('*').eq('email', email).maybeSingle();
  // Don't cache a missing profile: the signup trigger may create it a moment later.
  if (data) { prune(profileCache, now); profileCache.set(email, { profile: data, until: now + PROFILE_TTL_MS }); }
  return data || null;
}

function setCachedProfile(profile) {
  profileCache.set(profile.email, { profile, until: Date.now() + PROFILE_TTL_MS });
}

// ---------- middleware ----------
async function requireUser(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (!token) throw new Error('no token');
    const user = await verifyToken(token);
    const email = user.email.toLowerCase();
    if (!isCollegeEmail(email)) throw new Error('wrong domain');

    const profile = (await loadProfile(email)) || { email, id: user.id };
    req.user = { ...profile, email, role: isTeacher(email) ? 'teacher' : 'student' };
    next();
  } catch (e) {
    res.status(401).json({ error: 'Please log in again' });
  }
}

function requireTeacher(req, res, next) {
  requireUser(req, res, () => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only' });
    next();
  });
}

function requireProfile(req, res, next) {
  if (!profileComplete(req.user))
    return res.status(403).json({ error: 'Complete your profile first', code: 'profile_incomplete' });
  next();
}

module.exports = {
  DOMAIN, isCollegeEmail, isTeacher,
  publicUser, profileComplete, loadProfile, setCachedProfile,
  requireUser, requireTeacher, requireProfile,
};
