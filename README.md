# Campus Events

One web app for 3-4 events a day: students sign in with their college Google account, fill a profile once,
register for events with one tap, and mark attendance on the day by scanning a rotating QR code shown on the
projector. Teachers get a live count and a final CSV (registered, attended, absent).

Event status (Upcoming / Live / Ended) is computed from each event's start and end time. Nobody flips a switch.

Requires **Node.js 22 or newer** (check with `node -v`). If `npm install` fails in `server/` on Windows with a gyp / Visual Studio error, install the current Node LTS from nodejs.org (it ships a prebuilt SQLite binary for supported versions) and run it again.

## 1. Run it on your laptop (5 minutes)

```bash
cd server
cp .env.example .env          # then edit .env (see below)
npm install
npm start                     # API on http://localhost:4000

# second terminal
cd client
npm install
npm run dev                   # app on http://localhost:5173 (camera works on localhost)
```

In `.env` set:
- `JWT_SECRET` and `QR_SECRET`: two different random strings.
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `TEACHER_EMAILS`: comma-separated teacher emails (must end with @psgitech.ac.in).
- `DEV_LOGIN=1`: lets you log in by typing an email, with no Google. **For testing only**; it is ignored when
  `NODE_ENV=production`, but never leave it on for the real event.

Create events either with the teacher form (log in as a teacher, "+ New event") or by editing `server/src/seed.js`
and running `npm run seed` once (running it twice creates duplicates).

Run the automated API test any time: `npm test` (39 checks, uses a throwaway database).

## 2. Google Sign-In (needed for the real event)

1. https://console.cloud.google.com -> create a project -> APIs & Services -> **OAuth consent screen**.
   - If your college uses Google Workspace and you can create the project inside the college account, choose
     **Internal**: only @psgitech.ac.in accounts can sign in, no review needed.
   - Otherwise choose **External** and **publish it to production**. While it is in "Testing" only up to 100
     manually added test users can sign in, and you have 180 students.
2. Credentials -> Create credentials -> **OAuth client ID** -> Web application.
   Under **Authorized JavaScript origins** add your exact HTTPS URL (and `http://localhost:5173` for local work).
3. Copy the Client ID into `GOOGLE_CLIENT_ID` in `.env`. No client secret is needed.

The server verifies Google's signed token and checks that the email ends in `@psgitech.ac.in`.

## 3. Deploy (HTTPS is mandatory: phone cameras are blocked on plain http)

Single deployable: Express serves the built React app.

```bash
npm run build     # from the project root: installs and builds the client, installs the server
npm start         # one process on $PORT serving app + API
```

**WARNING about the database.** Data lives in one SQLite file (`server/data/event.db`, or `DB_PATH`).
Free tiers of most hosts have an **ephemeral disk**: Render's free web services, for example, lose local SQLite
files on every redeploy, restart and after 15 idle minutes, which would wipe all registrations.
Use one of:
- **Your own laptop or a college PC** running `npm start`, exposed over HTTPS with a tunnel such as
  `cloudflared tunnel --url http://localhost:4000` or `ngrok http 4000`. Add the printed https URL to the Google
  authorized origins. Keep the machine awake and plugged in. (Tunnel URLs change on restart, so start it once and leave it.)
- A host with a **persistent disk/volume** (paid), with `DB_PATH` pointing at the disk.

Whichever you pick, download each event's CSV right after it ends, and copy `event.db` as a backup.

## 4. Event-day checklist

- [ ] Deployed on HTTPS; log in as a teacher and as a student on two real phones
- [ ] Create a test event starting in 2 minutes; watch it go Upcoming -> Live, scan the QR, see the count rise, delete nothing (just ignore it)
- [ ] Students log in and register BEFORE the start time (registration closes when the event goes live)
- [ ] Teacher opens Events -> "Open control room" on the projector laptop -> "Full screen for projector"
- [ ] Someone counts heads in the hall and compares with the live count
- [ ] Download the CSV after the event

## 5. How the code works

### server/src/db.js
Opens SQLite and creates four tables: `users`, `events`, `registrations`, `attendance`. Every "only once" rule is a
database constraint, so duplicates are impossible even if two requests arrive at the same instant:
- `users.roll_no UNIQUE`: one roll number per account.
- `registrations PRIMARY KEY (event_id, email)`: register once per event, but for many events.
- `attendance PRIMARY KEY (event_id, email)`: marked present once per event.
- `attendance UNIQUE (event_id, device_id)`: one phone can mark only one student per event (anti-proxy).
`journal_mode = WAL` lets many dashboards read while a scan writes.

### server/src/status.js
`getStatus(event, now)` compares the clock to `starts_at` and `ends_at`; `attendanceOpen` also honours the optional
`attendance_closes_at`. Status is never stored, so a server restart or a forgotten button cannot make it wrong.
`now` is a parameter, which makes the logic testable at any moment.

### server/src/qr.js
The QR content is `HMAC-SHA256(QR_SECRET, eventId + 20-second time slot)`. Nothing is stored. The server recomputes
the token for the current and previous slot and compares in constant time. Students cannot predict the next code and an
old photo stops working within about 40 seconds at most.

### server/src/auth.js
Verifies the Google ID token with `google-auth-library`, then checks the email domain on the server. Issues a signed
3-day session JWT holding only the email. The role (teacher or student) is looked up from `TEACHER_EMAILS` on every
request, so it cannot be forged from the browser. Middleware: `requireUser`, `requireTeacher`, `requireProfile`.

### server/src/index.js (routes)
- `GET /api/events` returns every event with computed status, "am I registered/attended", registered count, checked-in
  count, and `serverTime`. This one call powers the dashboard and the live counter.
- `POST /api/events/:id/register` checks the time on the server (only while Upcoming) and relies on the primary key for
  "already registered".
- `GET /api/events/:id/qr` (teacher only, only while attendance is open) returns the current token.
- `POST /api/events/:id/attend` runs the checks cheapest-first: event exists, started, window open, device id present,
  QR fresh, student registered, not already marked, then inserts. A unique-constraint failure means either a double-tap
  (answered "duplicate") or a phone reused for another student ("device_used"). Rate-limited to 12 tries a minute per student.
- `POST /api/events/:id/manual` marks a registered student by roll number.
- `GET /api/events/:id/export.csv` is a `LEFT JOIN` from registrations to attendance: every registered student appears
  once, with no attendance row meaning "Absent". Times are shown in IST, cells beginning with `= + - @` are escaped so
  Excel cannot run them as formulas, and a BOM makes Excel read it as UTF-8.

### client/src
- `api.js`: fetch wrapper that adds the login token, plus a per-browser device id and the CSV download.
- `auth.jsx`: keeps the logged-in user in context and restores it on page load.
- `useEvents.js`: loads events every 10 s and ticks every second; it stores the difference between the server clock and
  the phone clock, so the badge flips to Live at the right second even on a phone with a wrong clock.
- `pages/Login.jsx`: Google button (or the dev login). `Profile.jsx`: name, department, year, roll number, once.
- `pages/Dashboard.jsx`: event cards with brochure, badge, Register / Registered, live "N checked in", Mark attendance.
- `pages/Attend.jsx`: opens the rear camera with `html5-qrcode`, sends each scan once (a lock stops the camera's repeated
  reads of the same code), shows the result.
- `pages/EventForm.jsx`: create/edit events. Converts the teacher's local time to UTC (the time-zone trap).
- `pages/TeacherEvent.jsx`: projector QR that refetches exactly when the token expires, live count, registered/attended/absent,
  manual check-in, CSV download.

## 6. What this cannot prevent
A friend inside the hall can photograph the projected QR and send it to someone outside within the ~20 second window.
The rotating code, one-device-per-event rule, logged IP/device, and a teacher's headcount make that hard and visible,
not impossible. The IP and device are stored in the `attendance` table for review.
