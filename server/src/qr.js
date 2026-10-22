// qr.js - rotating QR token.
// token = HMAC(secret, eventId + time slot). Nothing is stored in the database:
// the server can recompute the token for any slot, and students can't predict it.
// QR_WINDOW_SECONDS=0 turns rotation off: one fixed code per event (a photo of it works too).
// The QR carries "<eventId>.<token>", so a scan of another event's screen is reported as such
// instead of looking like an expired code.
const crypto = require('crypto');

const WINDOW_MS = Number(process.env.QR_WINDOW_SECONDS ?? 20) * 1000;
const FIXED = WINDOW_MS <= 0;
const POLL_MS = 15_000; // with a fixed code the console still re-checks, to notice attendance closing
const secret = () => process.env.QR_SECRET;

const slotNow = () => (FIXED ? 'fixed' : Math.floor(Date.now() / WINDOW_MS));

function tokenFor(eventId, slot) {
  return crypto.createHmac('sha256', secret())
    .update(`qr:${eventId}:${slot}`)
    .digest('base64url')
    .slice(0, 16);
}

// 'ok', 'wrong_event' (a QR from another event's screen) or 'expired'.
// Accept the current slot and the previous one, so a scan that lands exactly
// on a rollover isn't rejected.
function checkToken(eventId, scanned) {
  if (typeof scanned !== 'string') return 'expired';
  const m = /^(\d+)\.(.+)$/.exec(scanned);
  if (!m) return 'expired';
  if (Number(m[1]) !== Number(eventId)) return 'wrong_event';
  return isValidToken(eventId, m[2]) ? 'ok' : 'expired';
}

function isValidToken(eventId, token) {
  const s = slotNow();
  return (FIXED ? [s] : [s, s - 1]).some((slot) => {
    const expected = tokenFor(eventId, slot);
    return token.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  });
}

function currentToken(eventId) {
  const slot = slotNow();
  return {
    token: `${eventId}.${tokenFor(eventId, slot)}`,
    expiresInMs: FIXED ? POLL_MS : (slot + 1) * WINDOW_MS - Date.now(),
    windowMs: FIXED ? 0 : WINDOW_MS, // 0 tells the console the code doesn't rotate
  };
}

module.exports = { checkToken, currentToken };
