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

async function loadProfile(email) {
  const { data } = await supabase.from('profiles').select('*').eq('email', email).maybeSingle();
  return data || null;
}

// ---------- middleware ----------
async function requireUser(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (!token) throw new Error('no token');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user?.email) throw new Error('invalid token');
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
  publicUser, profileComplete, loadProfile,
  requireUser, requireTeacher, requireProfile,
};
