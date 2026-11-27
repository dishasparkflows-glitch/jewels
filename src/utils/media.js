const { CLOUDFLARE_R2 } = require('../config/constants');

function publicBase() {
  const base = CLOUDFLARE_R2?.PUBLIC_DOMAIN;
  return String(base || '').replace(/\/+$/, '');
}

function publicUrl(key) {
  if (!key) return '';
  const base = publicBase();
  return `${base}/${String(key).replace(/^\/+/, '')}`;
}

/**
 * Extracts clean object storage key from a string key, full URL, or { key, url } object.
 */
function extractKey(input, { bucketName = CLOUDFLARE_R2?.BUCKET_NAME } = {}) {
  if (!input) return '';
  if (typeof input === 'object') {
    if (typeof input.key === 'string' && input.key.trim()) {
      return extractKey(input.key, { bucketName });
    }
    if (typeof input.url === 'string' && input.url.trim()) {
      return extractKey(input.url, { bucketName });
    }
    return '';
  }
  if (typeof input !== 'string') return '';

  let clean = input.trim();
  const base = publicBase();
  if (base && clean.startsWith(`${base}/`)) {
    clean = clean.slice(base.length + 1);
  } else if (/^https?:\/\//i.test(clean)) {
    try {
      clean = new URL(clean).pathname;
    } catch {
      clean = clean.replace(/^https?:\/\/[^/]+\/?/i, '');
    }
  }

  clean = clean.split(/[?#]/)[0].replace(/^\/+/, '');
  try {
    clean = decodeURIComponent(clean);
  } catch {
    // preserve raw path if malformed URI encoding
  }
  if (bucketName && clean.startsWith(`${bucketName}/`)) {
    clean = clean.slice(bucketName.length + 1);
  }
  return clean;
}

function keyFromUrl(url, options) {
  return extractKey(url, options);
}

// Consistent image: { url, key } normalization helper
function normalizeMedia(val) {
  if (!val) return { url: '', key: '' };
  if (typeof val === 'string') return { url: val, key: '' };
  return { url: val.url || '', key: val.key || '' };
}

module.exports = {
  publicBase,
  publicUrl,
  extractKey,
  keyFromUrl,
  normalizeMedia,
};
