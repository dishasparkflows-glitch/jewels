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
  'video/webm;codecs=vp9': 'webm',
  'video/webm;codecs=vp8': 'webm',
  'video/quicktime': 'mov',
  'application/pdf': 'pdf',
};

// Logical module names mapped to canonical R2 folders and filename prefixes
const MODULE_CONFIG = {
  users: { folder: 'users', prefix: 'user' },
  categories: { folder: 'categories', prefix: 'category' },
  products: { folder: 'products', prefix: 'product' },
  banners: { folder: 'banners', prefix: 'banner' },
  diamonds: { folder: 'diamonds', prefix: 'diamond' },
  reviews: { folder: 'reviews', prefix: 'review' },
  vto: { folder: 'vto', prefix: 'vto' },
  birthstones: { folder: 'birthstones', prefix: 'birthstone' },
  'celebrate-gifts': { folder: 'celebrate-gifts', prefix: 'celebrate-gift' },
  featured: { folder: 'featured', prefix: 'featured' },
  settings: { folder: 'settings', prefix: 'setting' },
  'brand-logos': { folder: 'brand-logos', prefix: 'brand-logo' },
  'trust-badges': { folder: 'settings/trust-badges', prefix: 'trust-badge' },
  certificates: { folder: 'certificates', prefix: 'certificate' },
  'home-sections': { folder: 'home-sections', prefix: 'home-section' },
  'website-themes': { folder: 'website-themes', prefix: 'website-theme' },
  'before-after': { folder: 'before-after', prefix: 'before-after' },
  'custom-inquiries': { folder: 'custom-inquiries', prefix: 'custom-inquiry' },
  blogs: { folder: 'blogs', prefix: 'blog' },
  navigation: { folder: 'navigation', prefix: 'navigation' },
  'gemstone-types': { folder: 'gemstones/types', prefix: 'gemstone-type' },
  'gemstone-shapes': { folder: 'gemstones/shapes', prefix: 'gemstone-shape' },
  gemstones: { folder: 'gemstones', prefix: 'gemstone' },
  general: { folder: 'general', prefix: 'general' },
};

const CANONICAL_MODULES = Object.keys(MODULE_CONFIG);

// ------------------------------- generate r2 object key ----------------------------
function generateR2ObjectKey({ module: rawModule, contentType, productId, subfolder }) {
  if (!rawModule || typeof rawModule !== 'string' || !rawModule.trim()) {
    throw new ApiError(400, 'Module is required. Examples: "users", "categories", "products"');
  }

  const moduleName = rawModule.trim().toLowerCase();
  const normalizedKey = moduleName.startsWith('diamond/')
    ? 'diamonds'
    : moduleName.startsWith('gemstone/')
    ? (moduleName.includes('shape') ? 'gemstone-shapes' : 'gemstone-types')
    : moduleName.startsWith('navigation')
    ? 'navigation'
    : moduleName.includes('banner')
    ? 'banners'
    : moduleName;

  const config =
    MODULE_CONFIG[normalizedKey] ||
    MODULE_CONFIG[normalizedKey + 's'] ||
    MODULE_CONFIG[normalizedKey.replace(/s$/, '')] ||
    MODULE_CONFIG[normalizedKey.replace(/y$/, 'ies')] ||
    MODULE_CONFIG[normalizedKey.replace(/ies$/, 'y')];

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
  const baseMimeType = normalizedContentType.split(';')[0].trim();
  const extension = MIME_EXTENSION_MAP[baseMimeType] || MIME_EXTENSION_MAP[normalizedContentType];
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
  if (subfolder) {
    if (moduleName !== 'product' && moduleName !== 'products') {
      throw new ApiError(400, 'Subfolders are only supported for product media');
    }
    if (subfolder !== 'compressed') throw new ApiError(400, 'Unsupported product media subfolder');
    folder = `${folder}/compressed`;
  }
  const key = `${folder}/${filename}`;

  return {
    key,
    filename,
    folder,
    prefix: config.prefix,
    module: moduleName,
    contentType: baseMimeType,
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
