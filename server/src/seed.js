// seed.js - creates today's events from the command line (fallback if you don't want to use the teacher form).
// Edit the list below, then run:  npm run seed
// Times are written in IST (+05:30) and converted to UTC by new Date(...).toISOString().
require('dotenv').config();
const db = require('./db');

const events = [
  { title: 'Event 1', venue: 'Seminar Hall', start: '2026-10-22T10:00:00+05:30', end: '2026-10-22T11:30:00+05:30', closeAfterMin: 15 },
  { title: 'Event 2', venue: 'Seminar Hall', start: '2026-10-22T11:45:00+05:30', end: '2026-10-22T13:00:00+05:30', closeAfterMin: 15 },
  { title: 'Event 3', venue: 'Auditorium',   start: '2026-10-22T14:00:00+05:30', end: '2026-10-22T15:30:00+05:30', closeAfterMin: 15 },
];

const insert = db.prepare(`
  INSERT INTO events (title, description, brochure_url, venue, starts_at, ends_at, attendance_closes_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

for (const e of events) {
  const s = new Date(e.start);
  const closes = e.closeAfterMin ? new Date(s.getTime() + e.closeAfterMin * 60000).toISOString() : null;
  insert.run(e.title, e.description || '', e.brochure_url || null, e.venue, s.toISOString(), new Date(e.end).toISOString(), closes);
}
console.log(`Inserted ${events.length} events`);
