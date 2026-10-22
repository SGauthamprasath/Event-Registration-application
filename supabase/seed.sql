-- Campus Events — IAC 2026 seed data (from the brochures in client/public/brochures)
-- Paste into: Supabase → SQL Editor → New query → Run. Run schema.sql first.
-- Safe to re-run: ids are fixed (client/src/eventDetails.js is keyed by them) and
-- existing rows are updated in place. Times are IST.

insert into public.events (id, title, description, venue, starts_at, ends_at) values
  (1, 'Inauguration & Keynote: Innovation — Can You Be Innovative?',
      'Industry Academia Conclave 2026 opens with the inauguration and a guest session by Mr. Shriram Vasudevan, Director, Industrial AI & Agentic AI Solutions, Accenture.',
      'E8 Seminar Hall – II', '2026-10-23 09:00+05:30', '2026-10-23 10:30+05:30'),
  (2, 'Weaponized Autonomy: Surviving "Excessive Agency" in Agentic AI',
      'Keynote by Mr. Thirumoorthi T, Senior Software Engineer, Imperva, Bengaluru.',
      'E8 Seminar Hall – II', '2026-10-23 11:00+05:30', '2026-10-23 12:30+05:30'),
  (3, 'Cyber Forensics',
      'Keynote by Mr. Ashok Kumar Mohan, Founder & Director and Head of DFIR, Kriyavan Cyber Forensic Service Pvt. Ltd.',
      'E8 Seminar Hall – II', '2026-10-23 13:30+05:30', '2026-10-23 16:30+05:30'),
  (4, 'AI for Cybersecurity',
      'Keynote by Mr. Vivek Amruth Chinnasamy, Founder & CEO, XCODITS.',
      'E8 Seminar Hall – II', '2026-10-24 09:00+05:30', '2026-10-24 12:30+05:30'),
  (5, 'Project Expo',
      'An exciting Project Expo session showcasing innovative ideas and creative solutions, with Mr. Vivek Amruth Chinnasamy, Senior Consultant, Triple-id, Netherlands (Off Campus Chennai).',
      'E8-406', '2026-10-24 13:30+05:30', '2026-10-24 16:30+05:30')
on conflict (id) do update set
  title       = excluded.title,
  description = excluded.description,
  venue       = excluded.venue,
  starts_at   = excluded.starts_at,
  ends_at     = excluded.ends_at;

-- Explicit ids don't advance the bigserial; move it past them so the teacher form keeps working.
select setval(pg_get_serial_sequence('public.events', 'id'), greatest((select max(id) from public.events), 1));
