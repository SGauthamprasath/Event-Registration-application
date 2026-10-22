# Campus Events — UI Design Spec

Design brief for Stitch. The system is a lightweight event web app for a college:
students sign in with their college email, register for events in one tap,
and mark attendance by scanning a rotating QR shown on the auditorium
projector. Teachers create events, run the live "operator console" during
the event, and export a CSV when it ends.

The visual direction is **"Operator Console"** — a dark, high-density tech
HUD inspired by broadcast ops rooms and festival control panels. Every page
in this app must match the two reference screenshots:

1. Events Hub (student dashboard — hero + feature event + pass + venue grid)
2. Operator Console (teacher control room — QR stage + live ingestion stream)

Build every screen listed in §5 to this exact style.

---

## 1. Visual language — "Operator Console"

Dark, console-first, information-dense without feeling cramped. Rounded
chunky cards sit on a near-black field. Technical labels in uppercase mono
act like equipment tags. One lavender accent drives primary action, one
coral drives live/alert state, one mint drives system-OK — nothing else is
colored.

### 1.1 Palette (CSS custom properties)

Light mode is **not** supported for v1. Dark is the only theme.

| Token              | Hex       | Use                                              |
| ------------------ | --------- | ------------------------------------------------ |
| `--bg`             | `#0A0A0C` | Page background                                  |
| `--bg-elev`        | `#111114` | Slight-elevation sections (hero backdrop)        |
| `--surface`        | `#17171B` | Cards, panels, inputs                            |
| `--surface-2`      | `#1D1D23` | Nested cards, inner wells (QR frame, map tile)   |
| `--surface-hover`  | `#22222A` | Hover rows, hover chips                          |
| `--line`           | `#2A2A33` | Hairline borders, dividers                       |
| `--line-strong`    | `#3A3A45` | Stronger borders (sidebar seams)                 |
| `--ink`            | `#F2F2F2` | Primary text                                     |
| `--ink-2`          | `#B6B6BE` | Secondary text                                   |
| `--muted`          | `#7A7A85` | Meta, labels, timestamps                         |
| `--mono-dim`       | `#5A5A66` | De-emphasised mono (socket URLs, telemetry IDs)  |
| `--primary`        | `#B9B5FF` | Lavender — primary buttons, active nav, links    |
| `--primary-ink`    | `#0A0A0C` | Text on `--primary`                              |
| `--primary-soft`   | `rgba(185,181,255,0.14)` | Primary-tinted fills (pills)        |
| `--live`           | `#FF8A6E` | Coral — Live pills, verified count, present btn  |
| `--live-soft`      | `rgba(255,138,110,0.14)` | Live-tinted fills                   |
| `--ok`             | `#5BE1A4` | Mint — system OK dots, success states            |
| `--ok-soft`        | `rgba(91,225,164,0.14)` |                                      |
| `--warn`           | `#F0C65A` | Yellow — warnings                                |
| `--error`          | `#FF6B6B` | Red — hard errors                                |
| `--dept-cse`       | `#8EC5FF` |                                                  |
| `--dept-ece`       | `#C4B2FF` |                                                  |
| `--dept-it`        | `#FFC48E` |                                                  |
| `--dept-mech`      | `#B2E5A0` |                                                  |
| `--dept-ds`        | `#F0A0D8` |                                                  |

Department chip background is the colour at 14% alpha, text at 100%.

### 1.2 Typography

Three families only.

- **Display** — `"PP Neue Machina"` → fallback `"Space Grotesk"`. Weights
  500/700. All big headings and card titles. Slight negative tracking at
  large sizes (-1% to -2%).
- **Body/UI** — `"Inter"`. Weights 400/500/600.
- **Mono** — `"JetBrains Mono"`. Weights 400/500. Used for *every*
  uppercase label (`CAMPUS REAL-TIME RADAR`, `STAGE_HUD_ALPHA`,
  `TELEMETRY`), timestamps, roll numbers, token strings, socket URLs,
  and all stat numbers in the operator console.

Type scale (desktop → mobile):

| Role            | Size (px) | Family  | Weight | Case      |
| --------------- | --------- | ------- | ------ | --------- |
| Hero display    | 112 / 64  | Display | 700    | UPPERCASE |
| Page title      | 56 / 36   | Display | 700    | UPPERCASE |
| Section title   | 28 / 22   | Display | 500    | Sentence  |
| Card title (sm) | 20 / 18   | Display | 500    | UPPERCASE |
| Stat number     | 72 / 56   | Display | 700    | –         |
| Body            | 15 / 14   | Body    | 400    | Sentence  |
| Small           | 13 / 12   | Body    | 500    | Sentence  |
| Tag/label mono  | 11 / 11   | Mono    | 500    | UPPERCASE, letter-spacing 0.08em |
| Code mono       | 13 / 13   | Mono    | 500    | –         |

Line-height: 1.5 body, 1.05 display, 1 mono labels.

### 1.3 Shape & elevation

- Radius: `--r-sm` 10, `--r-md` 16, `--r-lg` 24, `--r-xl` 32, `--r-pill` 999.
- All cards: `--surface`, 1px `--line`, radius `--r-lg`, no outer shadow.
  Depth comes from colour layering, not shadows.
- Inner wells (QR frame, map tile, roster list) use `--surface-2` with the
  same border token, radius `--r-md`.
- Buttons: radius `--r-pill`, 44h, 20px side padding. The primary button
  carries a subtle 1px inset highlight on top (`inset 0 1px 0 rgba(255,255,255,0.15)`).
- Inputs: radius `--r-md`, 48h, 1px `--line`, focus ring 2px `--primary`
  outside the border (no shift).
- Images and brochures: radius `--r-md`.
- Chips / pills: 28h, 12px side padding, mono 11.

### 1.4 Decoration (the "console" details)

Use sparingly — they are what make the aesthetic read:

- **Bracket tags** — small mono labels wrapped in `[ ]` or `//`:
  `[STAGE 01 STREAM ONLINE]`, `// OPERATIONS`.
- **Status dots** — 8px filled circle before uppercase labels. Mint for OK,
  coral for live, lavender for armed, muted for idle.
- **Progress bars** — 4px tall, radius pill, `--surface-2` track, fill in
  a two-stop lavender→mint gradient. Used for capacity bars and the QR
  rotation countdown.
- **Divider labels** — hairline + centered mono tag, e.g.
  `────  CAMPUS VENUE GRID  ────`.
- **Keyboard hints** — `⌘K` glyph on the right of the search bar, inside a
  rounded square `--surface-2` chip.
- **Scanline-free.** Do not use CRT scanlines, retro-video noise, or synthwave
  gradients. The console vibe is Linear/Vercel-era, not VHS.

### 1.5 Motion

- Transitions 150ms ease-out (color/opacity), 240ms (size).
- Live dot pulses 1.4s, scale 1→1.3, opacity 1→0.5.
- Status pill flip (Upcoming → Live) crossfades 200ms, no bounce.
- QR rotation bar drains linearly over the window (20s by default).
- Reduced motion: freeze the pulse, keep only opacity transitions ≤120ms.

### 1.6 Iconography

Lucide, 1.5px stroke, 20px default size. Only where they clarify.
Common set: `qr-code`, `scan-line`, `camera`, `calendar`, `clock`,
`map-pin`, `tower-control`, `activity`, `radio`, `bell`, `user`,
`log-out`, `log-in`, `plus`, `pencil`, `trash-2`, `download`, `upload`,
`check`, `x`, `chevron-left`, `chevron-right`, `maximize`, `refresh-cw`,
`wifi`, `shield-check`, `command`, `search`, `hourglass`, `zap`, `menu`.
The app logo is `zap` inside a 36×36 rounded `--surface-2` square with
`--primary` icon colour.

### 1.7 Grid & spacing

4px base. Steps: 4, 8, 12, 16, 20, 24, 32, 48, 64, 96, 128.

- Page gutter: 16 (mobile), 32 (tablet), 48 (desktop).
- Max content width: 1400px.
- Dashboard uses a 12-column grid, 24px gutter, with the right rail taking
  cols 9–12 (`span 4`), feature content on cols 1–8 (`span 8`).
- Operator Console: 240px sidebar + fluid work area.
- Card inner padding: 24 desktop, 20 mobile.
- Vertical rhythm between sections: 48 desktop, 32 mobile.

### 1.8 Accessibility

- All targets ≥44×44.
- Focus ring: 2px `--primary`, 2px gap, visible on dark.
- Status must not depend on colour alone — always paired with text or icon.
- `aria-live="polite"` for the live counter and attendance result.
- Minimum contrast: 4.5:1 on body, 3:1 on display ≥24px.
- Reduced-motion users still see the Live state via text + dot (no pulse).

---

## 2. App shell

### 2.1 Student / default shell (used on Events Hub, My Registrations, Schedule, Profile, Attend)

Top bar, height 72, 1px `--line` beneath, pinned.

Left:
- Lightning logo square (36×36, `--surface-2`, `--primary` glyph).
- `CAMPUS EVENTS` display 16 uppercase + `PSG TECH PORTAL` mono 10 muted,
  stacked.

Center (nav pills, 36h):
- **Events Hub** (default active) · **Live Control Room** (teacher only) ·
  **My Registrations** · **Schedule**.
- Active pill: `--surface-2` background, `--ink` text; others: transparent,
  `--ink-2`, hover `--surface-hover`.

Right:
- Search field, 320w, rounded, `--surface-2`, placeholder
  `Search events, halls, speakers…`, with `⌘K` chip at the right.
- `● LIVE (1)` pill: coral dot + mono label. Hidden if no event is live.
- `STUDENT PASS` button → opens the pass drawer. Teacher sees
  `TEACHER CONSOLE` instead and it links to the operator console.
- Bell icon with notification dot.
- Avatar (initials circle, 32), opens the user menu (Profile, Logout).

Mobile: center nav collapses into a bottom bar with 4 icons + labels (Hub,
Registrations, Schedule, Me). The top bar keeps logo + search icon + avatar.

### 2.2 Operator Console shell (teacher only, used on Teacher Control Room, Event Form)

A left sidebar replaces the center nav.

Sidebar, 240w, full-height, `--surface` with 1px `--line` on the right:

- Header: `terminal-square` icon + `CONTROL` display 16 uppercase +
  `OPERATOR CONSOLE` mono 10 muted.
- Nav items (icon + label, 44h):
  - **Stage Ticker** (default active) — the per-event control view.
  - **Stage Dispatch** — list of events to pick.
  - **Access Gate QR** — standalone QR window for a second display.
  - **Capacity Sensor** — manual override + overrides log.
- Footer card: `TELEMETRY` mono 10, `NODE_ACTIVE_01` mono 13, mint OK dot.

Top bar inside the console (height 60):
- Breadcrumb: `PSG TECH // OPERATIONS` mono 11 muted.
- Live stream pill: `● LIVE STREAM 04` coral mono.
- Bell + avatar.

Mobile: the sidebar becomes a sheet triggered by the hamburger; the
operator views stack to a single column.

### 2.3 Global surfaces

- **Toasts**: bottom-centered pill, 320–480w, `--surface`, 1px `--line`,
  mono 11 title + body 13. Auto-dismiss 4s. Up to 3 stack with 8px gap.
- **Sheets / modals**: 560w max desktop, bottom sheet mobile. `--surface`
  with 1px `--line`, radius `--r-xl` top only on mobile sheet.
- **Empty states**: centered — small mono tag `// NOTHING TO SHOW`,
  display 24 title, 13 body, one CTA.
- **Error page**: mono tag `// SIGNAL LOST`, title "We lost that view.",
  retry button.

---

## 3. Component library

Every screen must compose from these.

| Component            | Spec                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------- |
| **Button**           | Variants: `primary` (lavender fill), `secondary` (surface-2 fill), `ghost` (border), `danger` (error border + text), `live` (coral fill). Sizes `md` 44h / `sm` 36h. States: default/hover/active/focus/loading/disabled. Icons sit 8px before the label. |
| **IconButton**       | Square 44 or 36, same variants.                                                       |
| **TextField**        | Mono 11 label above, 48h input, help text 13 below, red error ring.                   |
| **Select**           | Matches TextField, chevron right, native menu reskinned.                              |
| **DateTimeField**    | Monospaced input, calendar glyph, inline hint for timezone.                           |
| **CodeInput**        | 6 one-char mono boxes, 48×56, 12px gap, autoadvance.                                  |
| **SegmentedControl** | Row of pills inside a `--surface-2` track; selected pill is `--surface`.              |
| **Chip / FilterChip**| 32h pill, mono label; active fills with `--surface-2` and shows a count `(12)` in `--ink-2`. |
| **TagPill**          | Mono 11 inside `[ ]` or coloured dept bg (see dept palette).                          |
| **StatusPill**       | Upcoming (ghost + line), Live (coral soft + coral text + pulsing dot), Ended (surface-2 + muted). |
| **StatCard**         | Mono label + optional glyph top row; huge display number; small line beneath (unit / delta). |
| **Avatar**           | 28/32/48 initials circle, `--surface-2`, `--ink-2` text; department colour ring optional. |
| **EventCard**        | See §5.3.                                                                             |
| **FeatureEventCard** | See §5.3 (big hero card with background image/video).                                 |
| **PassCard**         | See §5.3 (student pass with QR + barcode).                                            |
| **QRStageCard**      | Big rotating QR, countdown bar, encrypted-sync indicator — see §5.5.                 |
| **IngestionRow**     | Avatar + name + dept chip + roll + seat + timestamp + VERIFIED tag.                   |
| **ProgressBar**      | 4h, gradient fill.                                                                    |
| **ToggleRow**        | Label + description + switch.                                                         |
| **Toast**            | See §2.3.                                                                             |
| **Sheet / Modal**    | See §2.3.                                                                             |
| **TopBar / Sidebar** | See §2.                                                                               |
| **EmptyState**       | See §2.3.                                                                             |

---

## 4. Content model (what each card knows)

- **Event**: id, title, description, venue, starts_at (UTC), ends_at (UTC),
  attendance_closes_at?, brochure_url?, tags[], speaker?, capacity?,
  stream_url?, computed: status (`upcoming` | `live` | `ended`),
  registered_count, checked_in_count, attendance_open,
  registered (per user), attended (per user).
- **User**: email, name, department, year, roll_no, role (`student` | `teacher`).
- **AttendanceEvent** (live stream row): user, event, timestamp, seat?,
  verified: boolean, source (`qr` | `manual`).

---

## 5. Screens

Each screen below must match the two reference screenshots. Spec is given
per screen with layout, states, and copy.

### 5.1 Login

**Purpose**: sign in with a college email + 6-digit mailed code. Dev mode
allows email-only sign-in when the server exposes it.

**Layout** (centered, max-width 440):

- Full-page dark `--bg`.
- A single card, 440w, 32 inner padding, `--surface`.
- Top: lightning logo + wordmark stacked.
- Mono tag: `// ACCESS CONTROL`.
- Display title: `CHECK IN TO CAMPUS EVENTS.`
- Body: "Sign in with your @psgitech.ac.in email. We'll mail you a one-time code."
- Step 1 — TextField `COLLEGE EMAIL`, button `SEND CODE` (primary, full width).
- Step 2 (replaces step 1 after send) — small mono recap of the email with
  an edit pencil; CodeInput 6-digit; `VERIFY` primary; `RESEND IN 00:58`
  ghost (disabled until timer ends).
- Footer: `Stuck? Ask the organiser.` muted small.

**States**:
- Rate-limited: inline mono hint under the button
  `COOLDOWN · 00:42 BEFORE NEXT CODE`.
- Wrong domain: inline red `Use your @psgitech.ac.in email.`
- Dev login enabled: a mono strip above the form `[DEV LOGIN ON] Any valid
  college email signs you in — no code required.`
- Loading: button shows a spinner and `SENDING…` / `VERIFYING…`.

### 5.2 Profile

**Purpose**: collect/edit name, department, year, roll number. Shown
automatically after first login; also reachable from the user menu.

**Layout** (max-width 720, 2-col form on desktop):

- Mono tag `// IDENTITY`.
- Display title `FINISH YOUR STUDENT PROFILE.`
- Body "We remember this. You only fill it once."
- Fields:
  - Full name (TextField).
  - Department (Select — CSE, ECE, EEE, MECH, CIVIL, AERO, BME, IT, MCA,
    MBA, Other). Shows the department tag colour inline when picked.
  - Year (SegmentedControl: 1 / 2 / 3 / 4 / PG).
  - Roll number (TextField, mono).
- Right rail (desktop only): preview card showing how the user will appear
  in the ingestion stream (avatar, name, dept chip, roll).
- Footer: primary `SAVE AND CONTINUE`; ghost `CANCEL` (edit mode only).

**States**:
- Roll already taken → red "That roll is already linked to another email."
- Missing field → red hint under field, button disabled.

### 5.3 Events Hub (student dashboard) — matches reference image 1

**Purpose**: hero + feature live event + student pass + venue grid + other
events. The home screen for a signed-in student. Teachers see the same
screen but with `CREATE EVENT` as the hero CTA.

**Layout** (12-col, 48px vertical rhythm):

**Row A — Top bar** (§2.1).

**Row B — Hero** (full width, 32 top padding):
- Mono tag line: `CAMPUS REAL-TIME RADAR  •  SPRING 2025 COHORT`.
- Display hero (112px desktop, 64 mobile), 3 lines:
  `WHAT'S  /  HAPPENING  /  ON CAMPUS.`
  Highlight: the word `CAMPUS.` fills with a lavender→coral linear gradient
  (same two accent colours used elsewhere). Everything else is `--ink`.
- Body paragraph, 420w, `--ink-2`: "Discover hackathons, guest lectures,
  robotics grand prix & workshops across all tech halls. Instant one-click
  credentials, real-time stage occupancy, and unified matrix scheduling."
- Hero stats bar (right side on desktop, below text on mobile):
  - StatCard `LIVE HALLS OCCUPANCY` → mint `84%` display 56 + `CAPACITY` label.
  - StatCard `ACTIVE PASSES` → `1,248` + `ISSUED`.
  - CTA button, primary, full-height: `+ CREATE EVENT` (teacher) or
    `+ CLAIM YOUR PASS` (student without pass) or hidden when the student
    already has one. The reference image shows this slot filled.

**Row C — Filter bar**:
- FilterChips: `ALL (12)`, `LIVE NOW (1)` (coral active), `UPCOMING (8)`,
  `MY REGISTERED (3)`, `ENDED`.
- Right: Select `Department: All Grids`, Search field `Search by tech, hall,
  speaker…`.

**Row D — Two-column body**:

Left (cols 1–8):

- **FeatureEventCard** (the live event):
  - 16:9 cinematic background photo of the hall, darkened 55%.
  - Top-left: coral `● LIVE NOW` pill + mono `[ KEYNOTE SPOTLIGHT ]`.
  - Top-right: mono `[STAGE 01 STREAM ONLINE]`.
  - Middle-left: `📍 NEWTON HALL (MAIN BLOCK)   |   🕒 10:00 AM – 01:00 PM IST [ACTIVE]` in mono 11.
  - Display 72 title (wraps): `AI & AGENTIC SYSTEMS SYMPOSIUM 2025`.
  - Body paragraph, 2 lines max.
  - **Capacity row**: `PHYSICAL CAPACITY` mono label + `119 CHECKED IN / 142 REGISTERED` mono + 4h gradient bar; below: muted `Gate 3 Door Closed   ·   23 SEATS LEFT`.
  - Actions (right side of this card): secondary `▶ VIEW STREAM`, primary
    `⌁ SCAN PROJECTOR PASS` (lavender).

- **Section**: mono divider `UP NEXT ON THE STAGE GRID   [4 EVENTS REGISTERING]`
  + chevron arrows for horizontal scroll.
- **EventCard grid**, 2 cols on desktop, 1 on mobile. Each card:
  - 16:10 brochure/preview image.
  - Overlay chip top-left: `[SLOT CONFIRMED ✓]` mint, or `[16 SEATS LEFT]`
    coral, or `[AUD 2 FULL (200/200)]` muted, or `[WAITLIST OPEN]` lavender.
  - Overlay chip top-right: `89 REGISTERED` mono.
  - Below the image, 20 padding:
    - Mono meta: `TOMORROW · 02:00 PM IST · MECH QUAD`.
    - Display 24 UPPERCASE title: `AUTONOMOUS ROBOTICS GRAND PRIX`.
    - Body 2 lines, `--ink-2`.
    - Tag row: `#Robotics  #Hardware  #GrandPrix` mono muted.
    - Divider.
    - Action row: left — small mono status (`✓ Pass Issued to Apple Wallet`
      / `FAST FILLING` / `FREE ACCESS PASS` / `QUEUE: 18 STUDENTS`),
      right — single primary button:
      - Upcoming + not registered → `REGISTER FOR PASS →`.
      - Upcoming + registered → ghost `ADD TO CAL`.
      - Waitlisted → `JOIN WAITLIST ≡`.
      - Full/ended → secondary muted `FREE RSVP ⚑` only when nothing to do.
    - Teacher sees `OPEN CONTROL ROOM →` primary and `EDIT ✎` ghost instead.

Right (cols 9–12, sticky to top of row D on desktop):

- **PassCard** (`STUDENT PASS`):
  - Mono header row: id glyph + `STUDENT PASS` display 18 UPPERCASE +
    mint OK dot (top-right).
  - Mono subrow: `PSG TECH   ·   FAST-GATE ACCESS`.
  - Row: `CARDHOLDER` label + full name display 20 + roll on the right
    (`ROLL ID` label + `21CSR042` mono 16).
  - `Dept of Computer Science & Eng` muted small.
  - Clearance strip: `shield-check` glyph + mono
    `ACCESS CLEARANCE: LEVEL 3` + green `VALID` tag + body
    `Symposium + Quad Labs Granted`.
  - **QR well** — 240×240 QR inside `--surface-2`, radius `--r-md`,
    with the lavender lightning glyph (36) centered over it as a watermark.
  - Below QR: barcode graphic + mono token `21CSR042-PSGTECH-GATE3-OK`.
  - Two buttons: secondary `⬇ OFFLINE PASS`, secondary `⇄ SYNC APPLE PAY`.

- Below the pass: **CAMPUS VENUE GRID** card:
  - Mono header: `CAMPUS VENUE GRID` + right `GRID REF // BLK-04`.
  - 16:9 map tile (`--surface-2`) with a lavender pin + ring + label
    `NEWTON HALL · QUAD` display 20 overlayed. Caption muted:
    `WALKING TIME: 3 MINS FROM CS LAB`.
  - List of 3 venues (rows): colour dot + name + sublabel + right-side
    occupancy chip (`92% FULL` coral, `OPEN GATES` mint, `READY` muted).
  - Footer link: `EXPLORE 3D CAMPUS WAYFINDER ↗` primary ghost.

**Row Z — Footer** (full width):
- Mono `CAMPUS EVENTS // TECH FESTIVAL MATRIX` on the left.
- Center: `Security Operations · Venue Grid · Support Desk`.
- Right: `PSG TECH CAMPUS ® 2025 · SYSTEM ACTIVE` with mint dot.

**States**:
- No live event → the FeatureEventCard swaps to an "Up next" variant: same
  layout but with the next upcoming event, replace `● LIVE NOW` with
  `[ STARTING IN 02:14:08 ]` mono, and remove `VIEW STREAM`.
- Empty events → EmptyState in the left column; the right rail stays.
- Loading → three skeleton cards with shimmer in the left column.

### 5.4 Event form (teacher)

**Purpose**: create/edit an event. Opened from the operator-console sidebar
`Stage Dispatch` or `+ CREATE EVENT` on the hub.

**Layout** (operator shell, 2-col form, max-width 960):

- Back link `← STAGE DISPATCH`.
- Mono tag `// EVENT COMPOSER`.
- Display 56 UPPERCASE title: `NEW STAGE EVENT.` or `EDIT STAGE EVENT.`
- Form:
  - Title (required).
  - Description (textarea, 5 rows, mono-friendly).
  - Venue (TextField with map pin).
  - Starts at / Ends at (DateTimeField, side by side).
  - Attendance closes at (DateTimeField, optional, muted hint
    `Defaults to the event end time`).
  - Capacity (number).
  - Brochure URL — if present, a 240×150 live preview appears below the
    field.
  - Tags (chip input, mono 11 `#tag`).
  - Toggle rows:
    - `Stream Online` — turn on and provide stream URL.
    - `Waitlist Enabled`.
    - `Attendance Chime` — audible beep on each valid check-in.
- Timezone note under the time fields: mono muted
  `LOCAL TZ · AUTO-CONVERTED TO UTC ON SAVE`.
- Footer: left — `DELETE EVENT` danger ghost (edit mode only, with confirm
  modal); right — ghost `CANCEL` + primary `SAVE EVENT`.

**States**:
- `ends_at` before `starts_at` → red hint on the ends field, Save disabled.
- Save loading → `SAVING…` with spinner on button.

### 5.5 Operator Console — Stage Ticker (teacher) — matches reference image 2

**Purpose**: run a single live event. Projector QR + live roster + stats +
manual override.

**Layout** (operator shell §2.2, two-column work area):

**Row A — Event header card** (full width, 24 padding, `--surface`):
- Left stack:
  - Row of pills: coral `● LIVE IN PROGRESS` + mono `|  🕒 01:14:22 elapsed  |`.
  - Meta line mono: `📍 Newton Hall  ·  142 Registered Students`.
  - Display 56 UPPERCASE title: `AI & AGENTIC SYSTEMS SYMPOSIUM 2025`.
- Right stack:
  - Primary big button: `⬆ ENTER FULLSCREEN PROJECTOR`.
  - Secondary row: `⟲ FORCE QR REFRESH` + `⬇ EXPORT CSV`.

**Row B — Two columns** (left 7, right 5):

Left — **QRStageCard**:
- Mono header row: `[STAGE_HUD_ALPHA]  AUDITORIUM FRONT-WALL RIG` on the
  left, right-aligned mint `● ENCRYPTED SYNC ACTIVE`.
- Inner well `--surface-2`, 32 padding:
  - 420×420 white QR card centered, with the lavender lightning glyph
    overlaid in the middle (same mark as the student pass).
  - Below the QR: mono label `ROTATION CYCLE` + right
    `Rotating in 00:06 seconds`.
  - 4h ProgressBar (gradient draining).
  - Second line: `CRYPTOGRAPHIC SEED` + right mono `TOKEN: 8f9b-e21a-4d70`.
- Footer strip: `shield-check` + "Anti-tamper dynamic QR code refreshes
  every 20 seconds to prevent screenshot forwarding and proxy check-ins."
- Button row: secondary `◐ HIGH CONTRAST VIEW` + secondary `📶 ROOM WI-FI TOKEN`.

Right — stacked cards, 16 gap:

1. **Stats row** — 3 StatCards side by side:
   - `REG` + users glyph + `142` + "Total Enrolled".
   - `VERIFIED` + coral dot + coral `89` + "62.6% Turnout" coral.
   - `PENDING` + hourglass glyph + `53` + "Expected In Hall".

2. **Manual override** card:
   - Mono header: `MANUAL ROLL OVERRIDE` + right muted mono
     `PRESS ENTER TO DISPATCH`.
   - Row: TextField `ENTER ROLL (E.G. 21CSR042)` + coral `live` button
     `☰ MARK PRESENT`.

3. **Live ingestion stream** card:
   - Mono header: `📋 LIVE INGESTION STREAM` + right mint pill
     `AUTO-STREAMING`.
   - List of up to 5 **IngestionRow**s:
     - Avatar with department colour ring (`AS`), name display 15 +
       dept TagPill (`CSE`), muted mono roll + seat (`21CSR042 · Seat C-14`),
       right-aligned timestamp mono + mint `VERIFIED`.
   - Footer: muted mono `LATENCY: 18ms   SOCKET: ws://stream-hall-4.local`.

4. Two small cards side by side:
   - **Keynote Stage** — mic glyph + `KEYNOTE STAGE` mono label +
     display 20 `Dr. Aris Thorne` + body `Autonomous Multi-Agent Routing`.
   - **Auditorium Sound** — mono `AUDITORIUM SOUND` + display 20
     `Chime Feedback` + body "Beep on valid check-in" + mint `ACTIVE` pill
     + ToggleRow switch (on).

**Fullscreen projector mode** (triggered by the header button):
- Hide sidebar + top bar. Pure `--bg`.
- Giant QR fills ~70vh centered.
- Above: display 72 UPPERCASE event title.
- Below: `ROTATING IN 00:12`, progress bar, mint sync dot.
- Esc exits.

**States**:
- Attendance not yet open → QRStageCard body swaps to a dark panel: mono
  `GATE CLOSED` + body "Attendance opens when the event goes Live at 10:00 AM."
  + a countdown.
- Window closed → panel reads "Attendance window closed." + reveals final
  stats + `EXPORT CSV` prominently.
- Socket disconnected → the `ENCRYPTED SYNC ACTIVE` indicator flips to
  coral `● RECONNECTING…` and the ingestion header pill becomes
  `BUFFERING…`.
- Manual override error → inline red mono under the input
  `[ERR] NOT REGISTERED FOR THIS EVENT`.

### 5.6 Operator Console — Stage Dispatch

**Purpose**: pick which event the operator is running. One list view inside
the operator shell.

**Layout**:
- Mono tag `// DISPATCH`.
- Display title `TODAY'S STAGE LINEUP.`
- Primary `+ NEW STAGE EVENT` (top right).
- A single column of row cards (not a grid), 72h each:
  - Left: large time block (mono display `10:00 AM`) + duration muted.
  - Center: display 20 UPPERCASE title + venue meta.
  - Right: StatusPill, registered count, mint OK dot if streaming,
    primary `OPEN STAGE →`.
- Sort chips above the list: `BY TIME · BY STATUS · BY VENUE`.

### 5.7 Operator Console — Access Gate QR

**Purpose**: a QR-only window a teacher pops onto a second monitor at the
hall entrance (no stats, no roster), still rotating.

**Layout**: operator shell, but the work area is just the QRStageCard at
`min(90vw, 90vh)` with no right column. A back link `← STAGE TICKER`.
`ENTER FULLSCREEN PROJECTOR` present.

### 5.8 Operator Console — Capacity Sensor

**Purpose**: fallback manual roll of attendees + override log.

**Layout**:
- Mono tag `// SENSOR`.
- Display `CAPACITY OVERRIDES.`
- Two columns: left — manual override card from §5.5; right — table of
  overrides (time mono, operator name + avatar, roll, event, reason).
- Button `EXPORT OVERRIDES CSV` at the top right.

### 5.9 Attend (student scanner) — mobile-first

**Purpose**: scan the projected QR to mark attendance.

**Layout** (full-screen on mobile):

- Top: back chevron + mono `// CHECK-IN`.
- Display 32 UPPERCASE `SCAN THE STAGE QR.`
- Camera viewfinder, 16:9, `--surface-2` frame with 4 L-bracket corner
  marks in `--primary` (3px, 32px long).
- Beneath: mono muted `POINT AT THE PROJECTOR QR  ·  AUTO-SUBMITS ON READ`.
- When a scan reads:
  - Success card below viewfinder: mint ring + `check` glyph +
    display 32 `PRESENT ✓` + body "You're marked for AI & Agentic Systems
    Symposium 2025 at 10:14 AM." + ghost `BACK TO HUB`.
  - Error card: coral ring + `x` glyph + display 24 ERROR title + body
    mapping to the server reason:
    - `not_registered` → "You're not registered for this event."
    - `duplicate` → "You're already marked present."
    - `device_used` → "This phone already checked in another student."
    - `qr_expired` → "That code expired. Scan again."
    - `too_many` → "Too many tries — wait a few seconds."
  - Button row: primary `TRY AGAIN` + ghost `BACK TO HUB`.

**States**:
- No camera permission → card prompts `GRANT CAMERA` with instructions
  link.
- Insecure context (http, not localhost) → mono yellow strip `[DEV] Camera
  requires HTTPS. On a phone, use the deployed URL.`
- Idle (no scan yet) → the mono subcaption animates one dot every 500ms:
  `POINT AT THE PROJECTOR QR.`, `..`, `...`.

### 5.10 My Registrations

**Purpose**: student history view linked from the top nav.

**Layout**:
- Mono tag `// YOUR TIMELINE`.
- Display title `REGISTERED STAGES.`
- Filter chips: `UPCOMING · LIVE · ATTENDED · MISSED`.
- Table/list (desktop) or stacked cards (mobile):
  - Date mono + event title display 18 + venue + StatusPill + attendance
    marker (`PRESENT ✓` mint / `MISSED` coral / `UPCOMING` muted).
  - Right-side primary: `OPEN PASS` or `MARK ATTENDANCE` depending on
    state.

### 5.11 Schedule

**Purpose**: a day/week calendar view of events across the campus.

**Layout**:
- Mono tag `// GRID VIEW`.
- Display title `CAMPUS SCHEDULE MATRIX.`
- Segmented control: `DAY · WEEK · FESTIVAL`.
- Grid of columns per venue (vertical time axis on the left in mono
  11), events as cards within. Live events get the coral border; events
  the student has registered for get a lavender border.
- Click an event opens a sheet with the full event detail and the
  Register / Mark attendance CTA.

### 5.12 Student Pass drawer

**Purpose**: the student's wallet pass, triggered by `STUDENT PASS` in the
top bar. On the Events Hub this content lives in the right rail already;
on other pages it opens as a right-side drawer (480w) with the same
PassCard inside.

### 5.13 Logout confirm

Modal, 400w: display `SIGN OUT?`, body "You'll need your email code to
sign back in.", buttons: ghost `STAY` + primary `SIGN OUT`.

---

## 6. Copy guidelines

- Buttons: UPPERCASE mono-weighted actions in the console
  (`MARK PRESENT`, `EXPORT CSV`, `ENTER FULLSCREEN PROJECTOR`). Mixed
  sentence case for conversational CTAs on the student side
  (`Register for pass`, `Send code`). Use the two sides consistently.
- Avoid shout emojis. Allowed glyphs: `✓ · ↗ → ← ⬆ ⬇ ⟲ ⌁ ●`.
- Never scold. Explain the *when* and *what to do next* (e.g.
  "Registration closed at 10:00 AM when the event went Live.").
- Times: `Thu, 24 Oct · 10:00 AM – 12:00 PM IST`.
- Numbers: thousand separators; attendance counts and roll numbers in
  mono.
- Error reasons map 1:1 to server codes (`duplicate`, `device_used`,
  `qr_expired`, `not_registered`, `too_many`).

---

## 7. Responsive rules

- Mobile first (375 reference). One-thumb reachability for every student
  action.
- Breakpoints: `sm 480`, `md 720`, `lg 1024`, `xl 1280`, `2xl 1440`.
- Below `lg`, the Events Hub right rail (Pass + Venue Grid) moves to the
  bottom of the page.
- Below `md`, the operator sidebar collapses to a hamburger sheet; the
  two-column work area becomes one column, QRStageCard first.
- Fullscreen projector mode is desktop-only, triggered via the Fullscreen
  API.
- Mobile bottom nav for the student shell (Hub · My Reg · Schedule · Me).

---

## 8. Flows (for Stitch's flow graph)

1. **First-time student** — Login → code → Profile → Events Hub.
2. **Event-day student** — Events Hub → feature event → `SCAN PROJECTOR
   PASS` → Attend scanner → success → back to Hub (card now shows
   `ATTENDANCE MARKED ✓`).
3. **Teacher creates event** — Events Hub → `+ CREATE EVENT` → Event form
   → Save → Stage Dispatch list shows the new event.
4. **Teacher runs event** — Operator Console → Stage Dispatch →
   `OPEN STAGE →` → Stage Ticker → `ENTER FULLSCREEN PROJECTOR` for the
   hall; manual overrides and CSV export from the right pane.
5. **Student checks history** — Top nav → My Registrations.
6. **Second-display QR** — Operator Console → Access Gate QR → Fullscreen.

---

## 9. Out of scope

- Marketing / landing page (the app is behind login).
- Admin role beyond "teacher"; no super-admin screen.
- Routing, data fetching, auth tokens, QR crypto — handled by the existing
  React app. Stitch produces the static UI only.
- Payments, ticketing, external calendar sync beyond the `ADD TO CAL`
  button stub.
