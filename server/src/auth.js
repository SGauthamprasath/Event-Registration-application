// auth.js - who is this person, and are they allowed in?
//  * Login: a one-time code mailed to the college address (see otp.js). The server
//    checks the email domain ITSELF before sending. The browser is never trusted for this.
//  * Session: our own short JWT that carries only the email.
//  * Role: decided on every request from the TEACHER_EMAILS list, never by the client.
const jwt = require('jsonwebtoken');
const db = require('./db');

const DOMAIN = (process.env.COLLEGE_DOMAIN || 'psgitech.ac.in').toLowerCase();
const teacherList = () =>
  (process.env.TEACHER_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

const isCollegeEmail = (email) =>
  typeof email === 'string' && email.toLowerCase().endsWith('@' + DOMAIN);

const isTeacher = (email) => teacherList().includes(email.toLowerCase());

const devLoginEnabled = () =>
  process.env.DEV_LOGIN === '1' && process.env.NODE_ENV !== 'production';

function issueSession(email) {
  // make sure the user row exists, then hand back a signed session token
  db.prepare('INSERT OR IGNORE INTO users (email) VALUES (?)').run(email);
  return jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '3d' });
}

const profileComplete = (u) => !!(u.name && u.department && u.year && u.roll_no);

function publicUser(u) {
  return {
    email: u.email, name: u.name, department: u.department, year: u.year,
    roll_no: u.roll_no, role: u.role, profileComplete: profileComplete(u),
  };
}

// ---------- middleware ----------
function requireUser(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    const { email } = jwt.verify(token, process.env.JWT_SECRET);
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!row) throw new Error('unknown user');
    req.user = { ...row, role: isTeacher(email) ? 'teacher' : 'student' };
    next();
  } catch {
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
  DOMAIN, isCollegeEmail, isTeacher, devLoginEnabled,
  issueSession, publicUser, profileComplete, requireUser, requireTeacher, requireProfile,
};
