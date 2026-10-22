// smoke.js - end-to-end API test using a throwaway DB. Run: npm test
const os = require('os'), path = require('path'), fs = require('fs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-'));
Object.assign(process.env, {
  DB_PATH: path.join(tmp, 't.db'), JWT_SECRET: 'j'.repeat(32), QR_SECRET: 'q'.repeat(32),
  DEV_LOGIN: '1', TEACHER_EMAILS: 'teach@psgitech.ac.in', QR_WINDOW_SECONDS: '20', PORT: '0',
});
delete process.env.NODE_ENV;

const app = require('../src/index.js');
const assert = require('assert');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0;
const ok = (name, cond) => { assert.ok(cond, 'FAILED: ' + name); pass++; console.log('  ok  ' + name); };

(async () => {
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, { token, body } = {}) => {
    const r = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch { json = text; }
    return { status: r.status, json, headers: r.headers };
  };
  const login = async (email) => (await call('POST', '/api/auth/dev', { body: { email } })).json;

  // ---- email OTP login (fake mailbox instead of SMTP)
  const inbox = {};
  require('../src/otp').setSender(async (email, code) => { inbox[email] = code; });
  const req = (email) => call('POST', '/api/auth/otp/request', { body: { email } });
  const ver = (email, code) => call('POST', '/api/auth/otp/verify', { body: { email, code } });
  ok('otp: non-college email rejected', (await req('x@gmail.com')).status === 400);
  ok('otp: code sent', (await req('Dave@psgitech.ac.in')).status === 200 && /^\d{6}$/.test(inbox['dave@psgitech.ac.in']));
  ok('otp: resend too soon -> 429', (await req('dave@psgitech.ac.in')).status === 429);
  const wrong = inbox['dave@psgitech.ac.in'] === '000000' ? '111111' : '000000';
  ok('otp: wrong code rejected', (await ver('dave@psgitech.ac.in', wrong)).status === 401);
  const good = await ver('dave@psgitech.ac.in', inbox['dave@psgitech.ac.in']);
  ok('otp: right code logs in', good.status === 200 && good.json.token && good.json.user.email === 'dave@psgitech.ac.in');
  ok('otp: code cannot be reused', (await ver('dave@psgitech.ac.in', inbox['dave@psgitech.ac.in'])).status === 401);
  await req('eve@psgitech.ac.in');
  for (let i = 0; i < 5; i++) await ver('eve@psgitech.ac.in', 'abcdef');
  ok('otp: locked after 5 wrong tries', (await ver('eve@psgitech.ac.in', inbox['eve@psgitech.ac.in'])).status === 401);

  // ---- login & roles
  const bad = await call('POST', '/api/auth/dev', { body: { email: 'x@gmail.com' } });
  ok('non-college email rejected', bad.status === 401);
  const T = await login('teach@psgitech.ac.in');
  ok('teacher email gets teacher role', T.user.role === 'teacher');
  const A = await login('alice@psgitech.ac.in');
  const B = await login('bob@psgitech.ac.in');
  const C = await login('carol@psgitech.ac.in');
  ok('student email gets student role', A.user.role === 'student' && !A.user.profileComplete);

  // ---- profile
  const early = await call('POST', '/api/events/1/register', { token: A.token });
  ok('register blocked before profile', early.status === 403);
  const prof = (u, n, roll) => call('PUT', '/api/me', { token: u.token, body: { name: n, department: 'AI&DS', year: 4, roll_no: roll } });
  ok('alice profile saved', (await prof(A, 'Alice', '22ad001')).status === 200);
  ok('bob profile saved', (await prof(B, 'Bob', '22ad002')).status === 200);
  ok('duplicate roll number rejected', (await prof(C, 'Carol', ' 22AD001 ')).status === 409);
  ok('carol profile saved', (await prof(C, '=cmd|evil', '22ad003')).status === 200);

  // ---- events
  const s = Date.now();
  const mk = (title, startOff, endOff, closeOff) => call('POST', '/api/events', {
    token: T.token,
    body: { title, venue: 'Hall', starts_at: new Date(s + startOff).toISOString(), ends_at: new Date(s + endOff).toISOString(),
            attendance_closes_at: closeOff ? new Date(s + closeOff).toISOString() : '' },
  });
  ok('student cannot create events', (await call('POST', '/api/events', { token: A.token, body: {} })).status === 403);
  ok('end before start rejected', (await mk('bad', 5000, 1000)).status === 400);
  const e1 = (await mk('Live Soon', 3000, 60000)).json.id;
  const e2 = (await mk('Later', 3_600_000, 7_200_000)).json.id;
  const e3 = (await mk('Short Window', 3000, 60000, 5000)).json.id;
  ok('events created', e1 && e2 && e3);

  let list = (await call('GET', '/api/events', { token: A.token })).json;
  ok('status upcoming before start', list.events.every((e) => e.status === 'upcoming'));

  // ---- registration
  ok('alice registers', (await call('POST', `/api/events/${e1}/register`, { token: A.token })).status === 200);
  ok('double register -> 409', (await call('POST', `/api/events/${e1}/register`, { token: A.token })).status === 409);
  ok('bob registers', (await call('POST', `/api/events/${e1}/register`, { token: B.token })).status === 200);
  ok('alice registers for 2nd event too', (await call('POST', `/api/events/${e2}/register`, { token: A.token })).status === 200);
  await call('POST', `/api/events/${e3}/register`, { token: A.token });
  // carol never registers for e1

  const early2 = await call('POST', `/api/events/${e1}/attend`, { token: A.token, body: { token: 'x', deviceId: 'device-aaaaaaaa' } });
  ok('attend before start -> not_started', early2.json.status === 'not_started');
  ok('teacher QR refused before start', (await call('GET', `/api/events/${e1}/qr`, { token: T.token })).status === 403);

  // ---- time flips to LIVE on its own
  await sleep(3300);
  list = (await call('GET', '/api/events', { token: A.token })).json;
  const live = list.events.find((e) => e.id === e1);
  ok('status flipped to live by clock', live.status === 'live' && live.attendance_open === true);
  ok('registration closed once live', (await call('POST', `/api/events/${e1}/register`, { token: C.token })).status === 403);
  ok('student cannot fetch QR', (await call('GET', `/api/events/${e1}/qr`, { token: A.token })).status === 403);

  const qr = (await call('GET', `/api/events/${e1}/qr`, { token: T.token })).json;
  ok('teacher gets QR token', typeof qr.token === 'string' && qr.token.length === 16);

  const att = (u, ev, token, dev) => call('POST', `/api/events/${ev}/attend`, { token: u.token, body: { token, deviceId: dev } });
  ok('wrong token -> expired', (await att(A, e1, 'AAAAAAAAAAAAAAAA', 'device-aaaaaaaa')).json.status === 'expired');
  ok('unregistered student -> not_registered', (await att(C, e1, qr.token, 'device-cccccccc')).json.status === 'not_registered');
  ok('alice marked', (await att(A, e1, qr.token, 'device-aaaaaaaa')).json.status === 'marked');
  ok('second scan -> duplicate', (await att(A, e1, qr.token, 'device-aaaaaaaa')).json.status === 'duplicate');
  const shared = await att(B, e1, qr.token, 'device-aaaaaaaa');
  ok('same phone for another student -> device_used', shared.json.status === 'device_used');
  ok('bob marked on own phone', (await att(B, e1, qr.token, 'device-bbbbbbbb')).json.status === 'marked');

  list = (await call('GET', '/api/events', { token: C.token })).json;
  ok('live count visible to everyone', list.events.find((e) => e.id === e1).checked_in === 2);

  // ---- window shorter than event
  await sleep(2200); // now ~5.5s after creation, past the 5s attendance close
  const qr3 = await call('GET', `/api/events/${e3}/qr`, { token: T.token });
  ok('attendance window closes before event ends', qr3.status === 403);

  // ---- manual override + stats
  ok('manual mark unregistered -> 404', (await call('POST', `/api/events/${e1}/manual`, { token: T.token, body: { roll_no: '22ad003' } })).status === 404);
  const man = await call('POST', `/api/events/${e3}/manual`, { token: T.token, body: { roll_no: '22ad001' } });
  ok('manual mark works after window closed', man.json.status === 'marked');
  const st = (await call('GET', `/api/events/${e1}/stats`, { token: T.token })).json;
  ok('stats registered=2 attended=2 absent=0', st.registered === 2 && st.attended === 2 && st.absent === 0);

  // ---- CSV: registered but absent student shows up
  await call('POST', `/api/events/${e2}/register`, { token: B.token });
  const csv2 = (await call('GET', `/api/events/${e2}/export.csv`, { token: T.token })).json;
  ok('CSV lists absent students', typeof csv2 === 'string' && csv2.includes('22AD001') && csv2.includes('Absent') && !csv2.includes('Attended'));
  const csv1 = (await call('GET', `/api/events/${e1}/export.csv`, { token: T.token })).json;
  ok('CSV lists attended students', csv1.includes('Attended') && csv1.includes('22AD002'));
  ok('student cannot export CSV', (await call('GET', `/api/events/${e1}/export.csv`, { token: A.token })).status === 403);
  console.log('\n--- CSV for event 1 ---\n' + csv1);

  // ---- ends on its own
  await sleep(1000);
  const edit = await call('PUT', `/api/events/${e1}`, { token: T.token, body: {
    title: 'Live Soon', starts_at: new Date(s + 3000).toISOString(), ends_at: new Date(Date.now() - 1000).toISOString() } });
  ok('teacher can end event early by editing time', edit.status === 200);
  list = (await call('GET', '/api/events', { token: A.token })).json;
  ok('status is ended after end time', list.events.find((e) => e.id === e1).status === 'ended');
  ok('attend after end -> closed', (await att(A, e1, qr.token, 'device-aaaaaaaa')).json.status === 'closed');

  console.log(`\nAll ${pass} checks passed`);
  server.close(); process.exit(0);
})().catch((e) => { console.error('\nTEST FAILED:', e.message); process.exit(1); });
