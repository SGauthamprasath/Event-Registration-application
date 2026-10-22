# Deploy — Supabase (DB + auth) + Render (API) + Vercel (frontend)

Written for the actual event day. ~15 minutes end to end.

## Architecture

- **Supabase** — Postgres database **and** email-OTP login. The one source of truth for users, profiles, events, registrations, attendance.
- **Render** — hosts the Express API (`server/`). The API uses the Supabase service_role key to read/write and runs the rotating-QR crypto (`QR_SECRET`). It never mails anything itself.
- **Vercel** — hosts the React SPA (`client/`). Talks to the Render API over HTTPS and to Supabase Auth directly for login.

## 0 · Supabase project — one-time setup

1. Create (or open) your Supabase project.
2. **SQL Editor → New query**. Paste the entire file [supabase/schema.sql](supabase/schema.sql). Run. This creates `profiles`, `events`, `registrations`, `attendance` + RLS policies + the auto-profile trigger on signup.
3. **Authentication → Providers → Email**:
   - Enable **Email provider**.
   - Enable **Email OTP** (the mailed-code flow; code length is under Auth → Providers → Email, and the login page accepts 6–8 digits). Disable **Confirm email** (we trust the OTP as proof).
   - Optional but **recommended for 180 students**: **Authentication → SMTP settings** → plug in your Gmail SMTP credentials. The default Supabase SMTP is throttled to ~30 emails/hour and will choke under a registration rush.
4. **Project Settings → API** — grab these:
   - `URL` → used as `SUPABASE_URL` (server) and `VITE_SUPABASE_URL` (client)
   - `anon public` key → used as `VITE_SUPABASE_PUBLISHABLE_KEY` (client, safe to expose)
   - `service_role` key → used as `SUPABASE_SERVICE_ROLE_KEY` (server only, **never** in the client)
5. **SQL Editor → New query**. Paste [supabase/seed.sql](supabase/seed.sql). Run. Loads the five IAC 2026 events (safe to re-run).

## 1 · Render — API

1. New → **Web Service** → connect the GitHub repo.
2. Settings:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Runtime**: Node 22 (set by `engines.node` in `server/package.json`).
3. Environment variables:
   - `NODE_ENV=production`
   - `QR_SECRET=<32+ random hex>` (reuse from local `.env`)
   - `SUPABASE_URL=https://<project>.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY=<service_role>`
   - `COLLEGE_DOMAIN=psgitech.ac.in`
   - `TEACHER_EMAILS=teacher1@psgitech.ac.in,teacher2@psgitech.ac.in`
   - `QR_WINDOW_SECONDS=20` (`0` = fixed code, no rotation)
   - `CORS_ORIGIN=https://<your-vercel-domain>.vercel.app` (fill in after step 2)
4. Deploy. Grab the URL — e.g. `https://campus-events-api.onrender.com`. Hit `/api/events` with a browser — expect `{"error":"Please log in again"}` (correct: that endpoint requires auth).

Render free tier spins down after 15 min idle; first wake-up is ~30 s. For event day either pay for a Starter instance ($7/mo) or hit the URL once right before guests arrive.

## 2 · Vercel — frontend

1. New Project → import the same repo.
2. Settings:
   - **Root Directory**: `client`
   - **Framework Preset**: Vite (auto-detected)
3. Environment variables:
   - `VITE_SUPABASE_URL=https://<project>.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY=<anon public key>`
   - `VITE_API_BASE=https://<your-render-url>.onrender.com`
4. Deploy.
5. Copy the Vercel URL → back in Render env vars set `CORS_ORIGIN=https://<that-url>`. Save → Render redeploys.
6. In Supabase → Authentication → **URL Configuration**, add the Vercel URL to **Site URL** and to **Additional redirect URLs**.

The `vercel.json` in `client/` handles SPA routing so `/events/3`, `/admin` etc. don't 404 on direct load. The brochure images (`client/public/brochures/*.webp`) ship with the build.

## 3 · Smoke test

- Open the Vercel URL on a laptop and a phone.
- Enter a real `@psgitech.ac.in` email → Supabase mails the code → paste → in. The `profiles` row is auto-created by the SQL trigger.
- Fill the profile.
- Register for an event. Watch the row land in Supabase → Table Editor → `registrations`.
- Promote yourself to teacher by adding your email to `TEACHER_EMAILS` on Render → redeploy → the Control Room + Admin nav links appear.
- As a teacher, open the Control Room → the rotating QR renders. On the student phone, open the live event → **Mark attendance** → scan → "Present ✓".
- Open Admin → counts update, downloading an event CSV works.

If the phone camera won't start, the page isn't HTTPS. Vercel always is, so this only breaks on a `http://` preview — Vercel auto-redirects anyway.

## 4 · Event-day checklist

- [ ] Render instance warmed up (hit it in the morning).
- [ ] Supabase SMTP is set (don't rely on the free 30/hour cap).
- [ ] Each teacher logs in on their phone *and* the projector laptop.
- [ ] Create / verify every real event via **Teacher → New event**.
- [ ] At the hall: open **Control Room** → **Fullscreen for projector**.
- [ ] After each event: **Download CSV** from the Admin page.
- [ ] Keep a backup laptop running locally in case Render misbehaves — `npm start` in `server/` + `npm run dev:phone` in `client/` (HTTPS, so phone cameras work) is Plan B. Both still point at the same Supabase project.

## 5 · Common gotchas

- **"invalid API key" / "Please log in again"** on every request: `SUPABASE_SERVICE_ROLE_KEY` is wrong or has stray whitespace. The service_role key is a JWT, starts with `eyJ`.
- **CORS error** in the browser console: `CORS_ORIGIN` on Render doesn't exactly match the Vercel URL (watch for `https://` and no trailing slash).
- **OTP emails not arriving**: Supabase SMTP isn't configured and you hit the 30/hour limit; or the sender is being spam-filtered. Point Supabase at Gmail SMTP (same credentials you used locally) in Authentication → SMTP settings.
- **Rate limiter blocks real students**: default is 12 attendance scans/min per student. Not usually a problem; raise `rateLimit({ limit: … })` in `server/src/index.js` only if you see legitimate 429s.
- **Live counts stale**: the client polls `/api/events` every 10 s. That's by design — don't tune lower on free Render or you'll chew the request quota.
