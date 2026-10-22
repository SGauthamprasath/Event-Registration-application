// otp.js - email one-time codes for login.
//  * A 6-digit code is mailed to the college address; only its HMAC is stored, never the code.
//  * Codes expire after OTP_TTL_MINUTES, allow OTP_MAX_ATTEMPTS guesses, and are deleted once used.
//  * One new code per email per OTP_RESEND_SECONDS, so nobody can flood an inbox.
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('./db');

const TTL_MIN = Number(process.env.OTP_TTL_MINUTES || 10);
const MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const RESEND_SEC = Number(process.env.OTP_RESEND_SECONDS || 60);

const hash = (email, code) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET).update(email + ':' + code).digest('hex');

const smtpConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter;
async function defaultSend(email, code) {
  if (!smtpConfigured()) {
    if (process.env.NODE_ENV === 'production') throw new Error('Email sending is not configured on the server');
    console.log(`[otp] SMTP not configured. Code for ${email}: ${code}`);
    return;
  }
  const port = Number(process.env.SMTP_PORT || 465);
  transporter = transporter || nodemailer.createTransport({
    host: process.env.SMTP_HOST, port, secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject: `Your Campus Events login code: ${code}`,
    text: `Your login code is ${code}. It expires in ${TTL_MIN} minutes.\n\nIf you did not try to sign in, ignore this email.`,
  });
}

let send = defaultSend;
const setSender = (fn) => { send = fn || defaultSend; }; // tests swap in a fake mailbox

// Returns { retryAfter } (seconds) when asked again too soon, otherwise sends a fresh code.
async function requestOtp(email) {
  const now = Date.now();
  const row = db.prepare('SELECT sent_at FROM login_codes WHERE email = ?').get(email);
  if (row && now - row.sent_at < RESEND_SEC * 1000)
    return { retryAfter: Math.ceil((RESEND_SEC * 1000 - (now - row.sent_at)) / 1000) };

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  db.prepare(`INSERT INTO login_codes (email, code_hash, expires_at, attempts, sent_at) VALUES (?, ?, ?, 0, ?)
              ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash, expires_at=excluded.expires_at,
              attempts=0, sent_at=excluded.sent_at`)
    .run(email, hash(email, code), now + TTL_MIN * 60_000, now);
  try {
    await send(email, code);
  } catch (e) {
    db.prepare('DELETE FROM login_codes WHERE email = ?').run(email); // let them retry straight away
    throw e;
  }
  return {};
}

// Throws with a user-facing message on any failure; returns normally only for the right code.
function verifyOtp(email, code) {
  const row = db.prepare('SELECT * FROM login_codes WHERE email = ?').get(email);
  if (!row || row.expires_at < Date.now()) throw new Error('Code expired. Request a new one.');
  if (row.attempts >= MAX_ATTEMPTS) throw new Error('Too many wrong tries. Request a new code.');

  const a = Buffer.from(hash(email, String(code || '').trim()), 'hex');
  const b = Buffer.from(row.code_hash, 'hex');
  if (!crypto.timingSafeEqual(a, b)) {
    db.prepare('UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?').run(email);
    throw new Error('Wrong code');
  }
  db.prepare('DELETE FROM login_codes WHERE email = ?').run(email);
}

module.exports = { requestOtp, verifyOtp, setSender, smtpConfigured };
