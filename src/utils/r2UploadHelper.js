const crypto = require('crypto');
const ApiError = require('./ApiError');

// Predefined allowlist of supported MIME types mapped to safe extensions
const MIME_EXTENSION_MAP = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'application/pdf': 'pdf',
};

// Logical module names mapped to canonical R2 folders and filename prefixes
const MODULE_CONFIG = {
  user: { folder: 'users', prefix: 'user' },
  users: { folder: 'users', prefix: 'user' },
  category: { folder: 'categories', prefix: 'category' },
  categories: { folder: 'categories', prefix: 'category' },
  product: { folder: 'products', prefix: 'product' },
  products: { folder: 'products', prefix: 'product' },
  navigation: { folder: 'navigation', prefix: 'navigation' },
  'navigation-icons': { folder: 'navigation', prefix: 'navigation' },
  banner: { folder: 'banners', prefix: 'banner' },
  banners: { folder: 'banners', prefix: 'banner' },
  'promo-banners': { folder: 'banners', prefix: 'banner' },
  diamond: { folder: 'diamonds', prefix: 'diamond' },
  diamonds: { folder: 'diamonds', prefix: 'diamond' },
  'diamond/shapes': { folder: 'diamonds', prefix: 'diamond' },
  'diamond/types': { folder: 'diamonds', prefix: 'diamond' },
  'diamond/clarity': { folder: 'diamonds', prefix: 'diamond' },
  'diamond/color': { folder: 'diamonds', prefix: 'diamond' },
  review: { folder: 'reviews', prefix: 'review' },
  reviews: { folder: 'reviews', prefix: 'review' },
  vto: { folder: 'vto', prefix: 'vto' },
  birthstone: { folder: 'birthstones', prefix: 'birthstone' },
  birthstones: { folder: 'birthstones', prefix: 'birthstone' },
  'celebrate-gift': { folder: 'celebrate-gifts', prefix: 'celebrate-gift' },
  'celebrate-gifts': { folder: 'celebrate-gifts', prefix: 'celebrate-gift' },
  featured: { folder: 'featured', prefix: 'featured' },
  setting: { folder: 'settings', prefix: 'setting' },
  settings: { folder: 'settings', prefix: 'setting' },
  'brand-logos': { folder: 'brand-logos', prefix: 'brand-logo' },
  certificates: { folder: 'certificates', prefix: 'certificate' },
  'home-section': { folder: 'home-sections', prefix: 'home-section' },
  'home-sections': { folder: 'home-sections', prefix: 'home-section' },
  'before-after': { folder: 'before-after', prefix: 'before-after' },
  general: { folder: 'general', prefix: 'general' },
};

const CANONICAL_MODULES = [
  'user',
  'category',
  'product',
  'navigation',
  'banner',
  'diamond',
  'review',
  'vto',
  'birthstone',
  'celebrate-gift',
  'setting',
  'home-section',
  'general',
];

/**
 * Validates module and contentType, then generates a unique R2 object key.
 * Naming convention: module-timestamp-shortId.extension
 * Object key: folder/module-timestamp-shortId.extension (e.g. categories/category-1792148468272-a3f7.jpg)
 */
function generateR2ObjectKey({ module: rawModule, contentType, productId }) {
  if (!rawModule || typeof rawModule !== 'string' || !rawModule.trim()) {
    throw new ApiError(400, 'Module is required. Examples: "user", "category", "product", "navigation"');
  }

  const moduleName = rawModule.trim().toLowerCase();
  const config = MODULE_CONFIG[moduleName];
  if (!config) {
    throw new ApiError(
      400,
      `Unsupported module "${rawModule}". Allowed modules: ${CANONICAL_MODULES.join(', ')}`
    );
  }

  if (!contentType || typeof contentType !== 'string' || !contentType.trim()) {
    throw new ApiError(400, 'Content-Type is required. Examples: "image/jpeg", "image/png", "image/webp"');
  }

  const normalizedContentType = contentType.trim().toLowerCase();
  const extension = MIME_EXTENSION_MAP[normalizedContentType];
  if (!extension) {
    const allowedTypes = Object.keys(MIME_EXTENSION_MAP).join(', ');
    throw new ApiError(
      400,
      `Unsupported contentType "${contentType}". Allowed types: ${allowedTypes}`
    );
  }

  const timestamp = Date.now();
  const shortId = crypto.randomBytes(2).toString('hex');
  const filename = `${config.prefix}-${timestamp}-${shortId}.${extension}`;
  let folder = config.folder;
  if (productId !== undefined && productId !== null && productId !== '') {
    folder = `${config.folder}/${String(productId).toLowerCase()}`;
  }
  const key = `${folder}/${filename}`;

  return {
    key,
    filename,
    folder,
    prefix: config.prefix,
    module: moduleName,
    contentType: normalizedContentType,
    extension,
    timestamp,
    shortId,
    uuid: shortId,
  };
}

module.exports = {
  MIME_EXTENSION_MAP,
  MODULE_CONFIG,
  CANONICAL_MODULES,
  generateR2ObjectKey,
};
