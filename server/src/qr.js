// qr.js - rotating QR token.
// token = HMAC(secret, eventId + time slot). Nothing is stored in the database:
// the server can recompute the token for any slot, and students can't predict it.
const crypto = require('crypto');

const WINDOW_MS = Number(process.env.QR_WINDOW_SECONDS || 20) * 1000;
const secret = () => process.env.QR_SECRET;

const slotNow = () => Math.floor(Date.now() / WINDOW_MS);

function tokenFor(eventId, slot) {
  return crypto.createHmac('sha256', secret())
    .update(`qr:${eventId}:${slot}`)
    .digest('base64url')
    .slice(0, 16);
}

// Accept the current slot and the previous one, so a scan that lands exactly
// on a rollover isn't rejected.
function isValidToken(eventId, token) {
  if (typeof token !== 'string') return false;
  const s = slotNow();
  return [s, s - 1].some((slot) => {
    const expected = tokenFor(eventId, slot);
    return token.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  });
}

function currentToken(eventId) {
  const slot = slotNow();
  return {
    token: tokenFor(eventId, slot),
    expiresInMs: (slot + 1) * WINDOW_MS - Date.now(),
    windowMs: WINDOW_MS,
  };
}

module.exports = { isValidToken, currentToken };
