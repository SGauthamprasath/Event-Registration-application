// status.js - event status is COMPUTED from the clock, never stored.
// Nothing to flip, nothing to forget, nothing to get out of sync after a restart.
const ms = (iso) => Date.parse(iso);

function getStatus(ev, now = Date.now()) {
  if (now < ms(ev.starts_at)) return 'upcoming';
  if (now < ms(ev.ends_at)) return 'live';
  return 'ended';
}

// Attendance is open from the start until attendance_closes_at (or ends_at).
function attendanceOpen(ev, now = Date.now()) {
  const closes = ms(ev.attendance_closes_at || ev.ends_at);
  return now >= ms(ev.starts_at) && now < closes;
}

module.exports = { getStatus, attendanceOpen };
