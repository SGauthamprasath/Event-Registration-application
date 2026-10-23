// status.js - event status is COMPUTED from the clock, never stored.
// Nothing to flip, nothing to forget, nothing to get out of sync after a restart.
const ms = (iso) => Date.parse(iso);

function getStatus(ev, now = Date.now()) {
  if (now < ms(ev.starts_at)) return 'upcoming';
  if (now < ms(ev.ends_at)) return 'live';
  return 'ended';
}

// Attendance is open from attendance_opens_at (or starts_at) until attendance_closes_at (or ends_at).
// The control room sets attendance_opens_at to open early, or late after a close.
function attendanceOpen(ev, now = Date.now()) {
  const opens = ms(ev.attendance_opens_at || ev.starts_at);
  const closes = ms(ev.attendance_closes_at || ev.ends_at);
  return now >= opens && now < closes;
}

// Registration stays open until the event ends, unless the control room closed it.
function registrationOpen(ev, now = Date.now()) {
  return !ev.registration_closed && now < ms(ev.ends_at);
}

module.exports = { getStatus, attendanceOpen, registrationOpen };
