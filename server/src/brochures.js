// brochures.js - event posters in a public Supabase Storage bucket.
// Each upload gets a new random file name, so a file never changes once written and can be
// cached for a year by the CDN and browsers: viewing a brochure never touches our server or the
// database. Replacing a brochure uploads a new file and deletes the old one.
const crypto = require('crypto');
const supabase = require('./supabase');

const BUCKET = 'brochures';
const MAX_BYTES = 3 * 1024 * 1024;
const YEAR_SECONDS = String(365 * 24 * 3600);
const PUBLIC_PREFIX = `${(process.env.SUPABASE_URL || '').replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/`;

// Sniff the real type from the first bytes instead of trusting the Content-Type header.
function imageType(buf) {
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return ['image/webp', 'webp'];
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ['image/jpeg', 'jpg'];
  if (buf.length > 8 && buf.toString('hex', 0, 8) === '89504e470d0a1a0a') return ['image/png', 'png'];
  return null;
}

let bucketReady = null;
function ensureBucket() {
  bucketReady ??= (async () => {
    const { data } = await supabase.storage.getBucket(BUCKET);
    if (data) return;
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: ['image/webp', 'image/jpeg', 'image/png'],
    });
    if (error && !/already exists/i.test(error.message)) throw error;
  })().catch((e) => { bucketReady = null; throw e; });
  return bucketReady;
}

// Returns the public URL, or { error } for a file that isn't an accepted image.
async function upload(buf) {
  if (!buf?.length) return { error: 'No image received' };
  if (buf.length > MAX_BYTES) return { error: 'Image is larger than 3 MB' };
  const type = imageType(buf);
  if (!type) return { error: 'Brochure must be a WebP, JPEG or PNG image' };
  await ensureBucket();
  const path = `${crypto.randomUUID()}.${type[1]}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buf, {
    contentType: type[0], cacheControl: YEAR_SECONDS, upsert: false,
  });
  if (error) throw error;
  return { url: PUBLIC_PREFIX + path };
}

// The object path for a URL in our bucket, or null for anything else (e.g. /brochures/iac-1.webp).
function pathOf(url) {
  if (typeof url !== 'string' || !url.startsWith(PUBLIC_PREFIX)) return null;
  const path = url.slice(PUBLIC_PREFIX.length);
  return /^[\w-]+\.(webp|jpg|png)$/.test(path) ? path : null;
}

const isOurs = (url) => !!pathOf(url);

// Best effort: a leftover file only costs storage, so a failed delete never fails the request.
async function remove(url) {
  const path = pathOf(url);
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.error('brochure delete failed', path, error.message);
}

module.exports = { upload, remove, isOurs, MAX_BYTES };
