function publicBase() {
  return (
    process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN ||
    process.env.CLOUDFLARE_R2_PUBLIC_URL ||
    'https://pub-82427c7fd20e4acaa4bdb3b933c0a3bf.r2.dev'
  ).replace(/\/+$/, '');
}

function publicUrl(key) {
  if (!key) return '';
  const base = publicBase();
  return `${base}/${key.replace(/^\/+/, '')}`;
}

function keyFromUrl(url) {
  if (typeof url !== 'string') return '';
  const base = publicBase();
  if (base && url.startsWith(`${base}/`)) {
    try {
      return decodeURIComponent(url.slice(base.length + 1).split(/[?#]/)[0]);
    } catch {
      return url.slice(base.length + 1).split(/[?#]/)[0];
    }
  }
  return '';
}

// Clean pass-through helpers for consistent image: { url, key } objects
function normalizeMedia(val) {
  if (!val) return { url: '', key: '' };
  if (typeof val === 'string') return { url: val, key: '' };
  return { url: val.url || '', key: val.key || '' };
}

function normalizeAssets(val) {
  return val;
}

function serializeMedia(val) {
  return val;
}

module.exports = {
  publicBase,
  publicUrl,
  keyFromUrl,
  normalizeMedia,
  normalizeAssets,
  serializeMedia,
};
