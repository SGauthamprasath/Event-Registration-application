// qr.js - rotating QR token.
// token = HMAC(secret, eventId + time slot). Nothing is stored in the database:
// the server can recompute the token for any slot, and students can't predict it.
// QR_WINDOW_SECONDS=0 turns rotation off: one fixed code per event (a photo of it works too).
// The QR carries "<eventId>.<token>", so a scan of another event's screen is reported as such
// instead of looking like an expired code.
const crypto = require('crypto');

const WINDOW_MS = Number(process.env.QR_WINDOW_SECONDS ?? 15) * 1000;
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
// Accept the current slot, the previous one (a scan that lands on a rollover) and the next one
// (the console flips to it on its own clock, which can run a moment ahead of the server).
function checkToken(eventId, scanned) {
  if (typeof scanned !== 'string') return 'expired';
  const m = /^(\d+)\.(.+)$/.exec(scanned);
  if (!m) return 'expired';
  if (Number(m[1]) !== Number(eventId)) return 'wrong_event';
  return isValidToken(eventId, m[2]) ? 'ok' : 'expired';
}

function isValidToken(eventId, token) {
  const s = slotNow();
  return (FIXED ? [s] : [s - 1, s, s + 1]).some((slot) => {
    const expected = tokenFor(eventId, slot);
    return token.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  });
}

// Also hands out the next slot's code, so the console can swap to it at the exact boundary
// instead of showing a stale code while it waits on the network.
function currentToken(eventId) {
  const slot = slotNow();
  return {
    token: `${eventId}.${tokenFor(eventId, slot)}`,
    next: FIXED ? null : `${eventId}.${tokenFor(eventId, slot + 1)}`,
    expiresInMs: FIXED ? POLL_MS : (slot + 1) * WINDOW_MS - Date.now(),
    windowMs: FIXED ? 0 : WINDOW_MS, // 0 tells the console the code doesn't rotate
  };
}

module.exports = { checkToken, currentToken };
