const mediaFields = new Set(['image', 'images', 'avatar', 'icon', 'banner', 'sizeChart', 'beforeImage', 'afterImage', 'lightImage', 'darkImage', 'mobileImage', 'logoImage', 'mobileLogoImage', 'certificateImage', 'referenceImages', 'ornateImages', 'vtoImage', 'variantIcon']);

function publicBase() {
  return (process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN || process.env.CLOUDFLARE_R2_PUBLIC_URL || '').replace(/\/+$/, '');
}

function keyFromUrl(url) {
  if (typeof url !== 'string') return '';
  const decode = (key) => { try { return decodeURIComponent(key); } catch { return key; } };
  const base = publicBase();
  if (base && url.startsWith(`${base}/`)) return decode(url.slice(base.length + 1).split(/[?#]/)[0]);
  const proxy = url.match(/^(?:https?:\/\/[^/]+)?\/api\/upload\/file\/(.+?)(?:[?#].*)?$/);
  return proxy ? decode(proxy[1]) : '';
}

function publicUrl(key) {
  const base = publicBase();
  if (!/^https?:\/\//i.test(base)) {
    const backend = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 9900}`).replace(/\/+$/, '');
    return `${backend}/api/upload/file/${key.split('/').map(encodeURIComponent).join('/')}`;
  }
  return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

function normalizeMedia(value) {
  const record = typeof value === 'string' ? { url: value } : { ...value };
  const url = typeof record.url === 'string' ? record.url.trim() : '';
  const derived = keyFromUrl(url);
  const key = derived || record.key || record.public_id || '';
  delete record.public_id;
  return { ...record, url: key && publicBase() && (!url || derived) ? publicUrl(key) : url, key };
}

// Also used by imports and migrations, not just HTTP requests.
function normalizeAssets(value, field = '') {
  if (Array.isArray(value)) return value.map((item) => normalizeAssets(item, field));
  if (typeof value === 'string' && mediaFields.has(field) && field !== 'icon') return normalizeMedia(value);
  if (!value || typeof value !== 'object' || value instanceof Date || value._bsontype || Buffer.isBuffer(value)) return value;
  const result = Object.fromEntries(Object.entries(value).map(([name, item]) => [name, normalizeAssets(item, name.split('.').pop())]));
  if ('imageUrl' in result) {
    result.image = normalizeMedia(result.image || { url: result.imageUrl, key: result.imageKey || result.imagePublicId || '' });
    delete result.imageUrl;
    delete result.imagePublicId;
    delete result.imageKey;
  }
  if ('url' in result && (mediaFields.has(field) || 'key' in result || 'public_id' in result)) return normalizeMedia(result);
  return result;
}

// Leave application keys (home-section keys, specifications, etc.) intact.
function serializeMedia(value) {
  if (Array.isArray(value)) return value.map(serializeMedia);
  if (!value || typeof value !== 'object' || value instanceof Date || value._bsontype || Buffer.isBuffer(value)) return value;
  if (typeof value.toJSON === 'function') return serializeMedia(value.toJSON());
  if ('imageUrl' in value) return serializeMedia(normalizeAssets(value));
  const media = typeof value.url === 'string' && ('key' in value || 'public_id' in value);
  return Object.fromEntries(Object.entries(value)
    .filter(([name]) => !(media && (name === 'key' || name === 'public_id')) && name !== 'imagePublicId' && name !== 'imageKey')
    .map(([name, item]) => [name, serializeMedia(item)]));
}

module.exports = { normalizeMedia, normalizeAssets, serializeMedia, keyFromUrl, publicUrl };
