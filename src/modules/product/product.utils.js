const mongoose = require('mongoose');
const ApiError = require('../../utils/ApiError');

const MASTER_METAL_COLORS = {
  '6ac90ab42c5692d9e254a047': { name: 'Yellow Gold', colorCode: '#E5C07B', colorCodeEnd: '#D4AF37', hex: '#E5C07B' },
  '6ac90ab42c5692d9e254a048': { name: 'White Gold', colorCode: '#F3F4F6', colorCodeEnd: '#E5E7EB', hex: '#F3F4F6' },
  '6ac90ab42c5692d9e254a049': { name: 'Rose Gold', colorCode: '#E8B4B8', colorCodeEnd: '#B76E79', hex: '#E8B4B8' },
};

const COLOR_HEX_DEFAULTS = {
  'white gold': '#dedede',
  'rose gold': '#e8b4b8',
  'yellow gold': '#e5c07b',
  silver: '#d4d4d4',
  platinum: '#e5e4e2',
  gold: '#d4b85b',
};

const resolveMetalColorInfo = (cObj, p = null) => {
  const isObj = typeof cObj === 'object' && cObj !== null;
  let id = isObj ? String(cObj._id || cObj.id || '') : (typeof cObj === 'string' && /^[a-f0-9]{24}$/i.test(cObj) ? cObj : '');
  let name = isObj ? cObj.name || '' : (typeof cObj === 'string' && !/^[a-f0-9]{24}$/i.test(cObj) ? cObj : '');
  let colorCode = isObj ? (cObj.colorCode || cObj.hex || cObj.code || '') : '';
  let colorCodeEnd = isObj ? (cObj.colorCodeEnd || '') : '';

  // If missing name or colorCode, try resolving from p.metalColorIds or p.metalColors
  if ((!name || !colorCode) && p) {
    const list = [
      ...(Array.isArray(p.metalColorIds) ? p.metalColorIds : []),
      ...(Array.isArray(p.metalColors) ? p.metalColors : []),
      ...(Array.isArray(p.representative?.metalColorIds) ? p.representative.metalColorIds : []),
      ...(Array.isArray(p.representative?.metalColors) ? p.representative.metalColors : []),
    ];
    for (const mc of list) {
      if (!mc) continue;
      const mcIsObj = typeof mc === 'object' && mc !== null;
      const mcId = mcIsObj ? String(mc._id || mc.id || '') : String(mc);
      const mcName = mcIsObj ? mc.name || '' : '';
      if ((id && mcId === id) || (name && mcName && mcName.toLowerCase() === name.toLowerCase())) {
        if (!id && mcId) id = mcId;
        if (!name && mcName) name = mcName;
        if (!colorCode && mcIsObj) colorCode = mc.colorCode || mc.hex || mc.code || '';
        if (!colorCodeEnd && mcIsObj) colorCodeEnd = mc.colorCodeEnd || '';
        break;
      }
    }
  }

  // Fallback to master metal colors if id known
  if (id && MASTER_METAL_COLORS[id]) {
    const m = MASTER_METAL_COLORS[id];
    if (!name) name = m.name;
    if (!colorCode) colorCode = m.colorCode;
    if (!colorCodeEnd) colorCodeEnd = m.colorCodeEnd;
  }

  // Fallback hex
  const fallbackHex = COLOR_HEX_DEFAULTS[(name || '').toLowerCase()] || '#d4d4d4';
  const hex = colorCode || fallbackHex;

  return { id, name, colorCode: colorCode || hex, colorCodeEnd, hex };
};

// Lean and aggregate results do not apply schema defaults to existing records.
const withColorStatuses = (product) => {
  if (!product) return product;
  if (Array.isArray(product.colorImages)) {
    product.colorImages = product.colorImages.map((ci) => {
      const validImgs = (ci.images || [])
        .map((img) => (typeof img === 'string' ? img : img?.url))
        .filter((url) => url && typeof url === 'string' && !/\.(mp4|webm|mov)(?:[?#]|$)/i.test(url));
      const firstPhoto =
        validImgs[0] ||
        (typeof ci.firstPhoto === 'string' ? ci.firstPhoto : '') ||
        (typeof ci.firstImage === 'string' ? ci.firstImage : '') ||
        (typeof ci.image === 'string' ? ci.image : '') ||
        '';
      const resolved = resolveMetalColorInfo(ci.metalColorId || ci.metalColor, product);
      const item = { ...ci };
      delete item.metalColor;
      return {
        ...item,
        status: item.status ?? 'active',
        metalColorId: resolved.name
          ? {
              _id: resolved.id || undefined,
              name: resolved.name,
              colorCode: resolved.colorCode || resolved.hex,
              colorCodeEnd: resolved.colorCodeEnd,
              hex: resolved.hex,
            }
          : (item.metalColorId || null),
        firstPhoto,
      };
    });
  }
  if (!product.metalColors || !product.metalColors.length) {
    product.metalColors = extractMetalColors(product);
  }
  return product;
};

// Remove empty or non-ObjectId metalColorId from colorImages entries
const sanitizeColorImages = (colorImages) => {
  if (!Array.isArray(colorImages)) return colorImages;
  return colorImages.map((ci) => {
    const item = { ...ci };
    if (!item.metalColorId || !mongoose.isValidObjectId(item.metalColorId)) {
      delete item.metalColorId;
    }
    return item;
  });
};

const PRICING_COMPARISON_KEYS = [
  'pricingKey', 'sku', 'combination', 'sideDiamondWeight', 'centerDiamondWeight', 'centerDiamondRate', 'certificateCharge', 'subtotal',
  'price',
  'metalCost',
  'metalRate',
  'metalWeight',
  'centerDiamondCost',
  'sideDiamondCost',
  'computedGst',
  'labourCharge',
  'otherAmount',
];

/**
 * Checks whether the newly calculated pricing matches existing stored values.
 */
const isPricingUnchanged = (product, result) => {
  if (!product || !result) return false;
  if (result.salePrice !== product.pricing?.salePrice) return false;
  if (!Array.isArray(result.variants) || !Array.isArray(product.variants)) return false;
  if (result.variants.length !== product.variants.length) return false;

  return result.variants.every((v, i) => {
    const origVariant = product.variants[i];
    if (!origVariant) return false;
    return PRICING_COMPARISON_KEYS.every((key) => v[key] === origVariant[key]);
  });
};

/**
 * Helper to format concise product card info for the home page storefront
 */
const extractProductImages = (p) => {
  if (!p) return [];
  const images = [];

  // 1. Direct images array (strings or objects with url)
  if (Array.isArray(p.images)) {
    p.images.forEach((img) => {
      const u = typeof img === 'string' ? img : img?.url;
      if (u && typeof u === 'string' && u.trim()) images.push(u.trim());
    });
  }

  // 2. Color images
  if (Array.isArray(p.colorImages)) {
    p.colorImages.forEach((c) => {
      if (Array.isArray(c?.images)) {
        c.images.forEach((img) => {
          const u = typeof img === 'string' ? img : img?.url;
          if (u && typeof u === 'string' && u.trim()) images.push(u.trim());
        });
      }
    });
  }

  // 3. Ornate images (from ERP / R2)
  if (Array.isArray(p.ornate?.ornateImages)) {
    p.ornate.ornateImages.forEach((img) => {
      const u = typeof img === 'string' ? img : img?.url;
      if (u && typeof u === 'string' && u.trim()) images.push(u.trim());
    });
  }

  // 4. Group representative images
  if (p.representative) {
    if (Array.isArray(p.representative.images)) {
      p.representative.images.forEach((img) => {
        const u = typeof img === 'string' ? img : img?.url;
        if (u && typeof u === 'string' && u.trim()) images.push(u.trim());
      });
    }
    if (Array.isArray(p.representative.colorImages)) {
      p.representative.colorImages.forEach((c) => {
        if (Array.isArray(c?.images)) {
          c.images.forEach((img) => {
            const u = typeof img === 'string' ? img : img?.url;
            if (u && typeof u === 'string' && u.trim()) images.push(u.trim());
          });
        }
      });
    }
    if (Array.isArray(p.representative.ornate?.ornateImages)) {
      p.representative.ornate.ornateImages.forEach((img) => {
        const u = typeof img === 'string' ? img : img?.url;
        if (u && typeof u === 'string' && u.trim()) images.push(u.trim());
      });
    }
  }

  // 5. Single image fallback
  if (p.image) {
    const u = typeof p.image === 'string' ? p.image : p.image?.url;
    if (u && typeof u === 'string' && u.trim()) images.push(u.trim());
  }

  return [...new Set(images)];
};

const extractMetalColors = (p) => {
  if (!p) return [];
  const colorMap = new Map();

  const sourceColorImages = Array.isArray(p.colorImages) && p.colorImages.length > 0
    ? p.colorImages
    : (Array.isArray(p.representative?.colorImages) ? p.representative.colorImages : []);

  // 1. Process colorImages rows
  for (const row of sourceColorImages) {
    if (!row || row.status === 'inactive') continue;
    const cObj = row.metalColor || row.metalColorId || row.color;
    const resolved = resolveMetalColorInfo(cObj, p);
    const key = (resolved.name || resolved.id || resolved.hex || '').toLowerCase().trim();
    if (!key) continue;

    const validImages = (row.images || [])
      .map((img) => (typeof img === 'string' ? img : img?.url))
      .filter((url) => url && typeof url === 'string' && !/\.(mp4|webm|mov)(?:[?#]|$)/i.test(url));

    const firstPhoto =
      validImages[0] ||
      (typeof row.firstPhoto === 'string' ? row.firstPhoto : '') ||
      (typeof row.firstImage === 'string' ? row.firstImage : '') ||
      (typeof row.image === 'string' ? row.image : '') ||
      '';

    colorMap.set(key, {
      id: resolved.id || undefined,
      name: resolved.name || key,
      colorCode: resolved.colorCode,
      colorCodeEnd: resolved.colorCodeEnd,
      hex: resolved.hex,
      firstPhoto,
      images: validImages,
    });
  }

  // 2. Also process metalColorIds & metalColors
  const sourceMetalColors = [
    ...(Array.isArray(p.metalColorIds) ? p.metalColorIds : []),
    ...(Array.isArray(p.metalColors) ? p.metalColors : []),
    ...(Array.isArray(p.representative?.metalColorIds) ? p.representative.metalColorIds : []),
    ...(Array.isArray(p.representative?.metalColors) ? p.representative.metalColors : []),
  ];

  for (const mc of sourceMetalColors) {
    if (!mc) continue;
    const resolved = resolveMetalColorInfo(mc, p);
    const key = (resolved.name || resolved.id || resolved.hex || '').toLowerCase().trim();
    if (!key) continue;

    if (colorMap.has(key)) {
      const existing = colorMap.get(key);
      if (!existing.id && resolved.id) existing.id = resolved.id;
      if (!existing.name && resolved.name) existing.name = resolved.name;
      if (!existing.colorCode && resolved.colorCode) existing.colorCode = resolved.colorCode;
      if (!existing.colorCodeEnd && resolved.colorCodeEnd) existing.colorCodeEnd = resolved.colorCodeEnd;
      if (!existing.hex && resolved.hex) existing.hex = resolved.hex;
    } else {
      let matchedPhoto = '';
      let matchedImages = [];
      for (const row of sourceColorImages) {
        if (!row || row.status === 'inactive') continue;
        const rResolved = resolveMetalColorInfo(row.metalColor || row.metalColorId || row.color, p);
        if (
          (resolved.id && rResolved.id && resolved.id === rResolved.id) ||
          (resolved.name && rResolved.name && resolved.name.toLowerCase() === rResolved.name.toLowerCase())
        ) {
          matchedImages = (row.images || [])
            .map((img) => (typeof img === 'string' ? img : img?.url))
            .filter((url) => url && typeof url === 'string' && !/\.(mp4|webm|mov)(?:[?#]|$)/i.test(url));
          matchedPhoto =
            matchedImages[0] ||
            (typeof row.firstPhoto === 'string' ? row.firstPhoto : '') ||
            (typeof row.firstImage === 'string' ? row.firstImage : '') ||
            (typeof row.image === 'string' ? row.image : '') ||
            '';
          break;
        }
      }

      colorMap.set(key, {
        id: resolved.id || undefined,
        name: resolved.name || key,
        colorCode: resolved.colorCode,
        colorCodeEnd: resolved.colorCodeEnd,
        hex: resolved.hex,
        firstPhoto: matchedPhoto,
        images: matchedImages,
      });
    }
  }

  return Array.from(colorMap.values());
};

const formatColorImages = (colorImages, p = null) => {
  if (!Array.isArray(colorImages)) return [];
  return colorImages
    .map((ci) => {
      if (!ci) return null;
      const cObj = ci.metalColor || ci.metalColorId;
      const resolved = resolveMetalColorInfo(cObj, p);

      const validImages = (ci.images || [])
        .map((img) => (typeof img === 'string' ? img : img?.url))
        .filter((url) => url && typeof url === 'string' && !/\.(mp4|webm|mov)(?:[?#]|$)/i.test(url));

      const firstPhoto =
        validImages[0] ||
        (typeof ci.firstPhoto === 'string' ? ci.firstPhoto : '') ||
        (typeof ci.firstImage === 'string' ? ci.firstImage : '') ||
        (typeof ci.image === 'string' ? ci.image : '') ||
        '';

      return {
        status: ci.status || 'active',
        metalColorId: {
          _id: resolved.id || undefined,
          name: resolved.name || '',
          colorCode: resolved.colorCode || resolved.hex,
          colorCodeEnd: resolved.colorCodeEnd,
          hex: resolved.hex,
        },
        firstPhoto,
        images: (ci.images || []).map((img) =>
          typeof img === 'string'
            ? { url: img, mediaType: 'image' }
            : { url: img?.url, mediaType: img?.mediaType || 'image', key: img?.key }
        ),
      };
    })
    .filter(Boolean);
};

/**
 * Format storefront products (returning images, metal colors, 1st photos, basicInfo, pricing, etc.)
 */
const formatStorefrontProduct = (p) => {
  if (!p) return null;
  const isGroup = Boolean(p.isGroup);
  let title = p.basicInfo?.title || p.groupName || p.name || 'Untitled product';
  let slug = p.basicInfo?.slug || p.slug || '';

  // Clean trailing sequence numbers if present (e.g. -000030)
  if (slug && /-\d{6}$/.test(slug)) {
    slug = slug.replace(/-\d{6}$/, '');
  }

  // If title was auto-generated with " - <barcode>" on single-product items, clean it
  if (title && (p.variantCount <= 1 || !isGroup) && title.includes(' - ')) {
    const parts = title.split(' - ');
    if (parts.length === 2 && /^\d+$/.test(parts[1].trim())) {
      title = parts[0].trim();
    }
  }

  const description = p.basicInfo?.description || p.description || '';
  const images = extractProductImages(p);

  const salePrice = Number(p.pricing?.salePrice || 0);
  const isGold = String(p.productType || '').toLowerCase() === 'gold';
  const mrp = isGold ? salePrice : Number(p.pricing?.mrp || salePrice || 0);
  const minPrice = Number(p.pricing?.minPrice || salePrice || 0);
  const maxPrice = Number(p.pricing?.maxPrice || (isGold ? salePrice : mrp) || salePrice || 0);

  const categoryIds = Array.isArray(p.categoryIds) ? p.categoryIds : (p.categoryIds ? [p.categoryIds] : []);
  const menuItemIds = Array.isArray(p.menuItemIds) ? p.menuItemIds : (p.menuItemIds ? [p.menuItemIds] : []);
  const gender = p.gender || p.basicInfo?.gender || [];

  const metalColors = extractMetalColors(p);
  const colorImages = formatColorImages(p.colorImages || p.representative?.colorImages || [], p);
  const metalColorIds = Array.isArray(p.metalColorIds)
    ? p.metalColorIds
    : (Array.isArray(p.representative?.metalColorIds) ? p.representative.metalColorIds : []);

  let selectedAttributes = undefined;
  if (p.productType === 'gold') {
    const firstVariant = Array.isArray(p.variants) && p.variants[0] ? p.variants[0] : null;
    const firstCenterRow = Array.isArray(p.centerDiamondRows) && p.centerDiamondRows[0] ? p.centerDiamondRows[0] : null;
    const firstMetalColor = metalColors[0]?.id || (Array.isArray(p.metalColorIds) ? p.metalColorIds[0] : null);

    selectedAttributes = {
      metalPurity: firstVariant?.metalPurityId || (Array.isArray(p.metalPurityIds) ? p.metalPurityIds[0] : null) || null,
      metalColor: firstVariant?.metalColorId || firstMetalColor || null,
      diamondType: firstVariant?.diamondTypeId || firstCenterRow?.diamondTypeId || null,
      diamondShape: firstVariant?.diamondShapeId || firstCenterRow?.diamondShapeId || null,
      diamondClarity: firstVariant?.diamondClarityId || firstCenterRow?.diamondClarityId || null,
      diamondColor: firstVariant?.diamondColorId || firstCenterRow?.diamondColorId || null,
      caratWeight: Number(firstVariant?.caratWeight ?? firstCenterRow?.caratWeight ?? 1.5),
      size: null,
      sizeRange: null,
    };
  }

  return {
    _id: p._id,
    id: p._id,
    title,
    slug,
    images,
    image: images[0] || '',
    metalColors,
    colorImages,
    metalColorIds,
    basicInfo: {
      title,
      slug,
      description,
      gender,
    },
    pricing: {
      salePrice,
      mrp,
      minPrice,
      maxPrice,
    },
    isGroup,
    variantCount: p.variantCount || 0,
    categoryIds,
    menuItemIds,
    gender,
    productType: p.productType || '',
    stockStatus: p.stockStatus || '',
    selectedAttributes,
  };
};

const formatHomeProduct = (p) => {
  return formatStorefrontProduct(p);
};

/**
 * Helper to format product lookup results for dropdowns / admin selection
 */
const formatLookupProduct = (p) => {
  if (!p) return null;
  withColorStatuses(p);

  const title = p.basicInfo?.title || p.title || p.name || 'Untitled product';
  const sku = p.basicInfo?.sku || p.sku || p.ornate?.itemCode || p.ornate?.tagNo || '';
  const effectivePrice = Number(p.pricing?.salePrice || p.pricing?.mrp || p.cataloguePrice || 0);

  // Extract 1st photo from colorImages (first valid image that is not a video)
  let firstPhoto = '';
  if (Array.isArray(p.colorImages)) {
    for (const color of p.colorImages) {
      if (Array.isArray(color.images)) {
        for (const img of color.images) {
          const u = typeof img === 'string' ? img : img?.url;
          const mediaType = typeof img === 'object' ? img?.mediaType : '';
          if (u && typeof u === 'string' && u.trim() && mediaType !== 'video') {
            firstPhoto = u.trim();
            break;
          }
        }
      }
      if (firstPhoto) break;
    }
  }

  // Fallback to p.images, p.ornate.ornateImages, or p.image if colorImages has no photo
  if (!firstPhoto && Array.isArray(p.images)) {
    for (const img of p.images) {
      const u = typeof img === 'string' ? img : img?.url;
      if (u && typeof u === 'string' && u.trim() && !/\.(mp4|webm|mov)(?:[?#]|$)/i.test(u)) {
        firstPhoto = u.trim();
        break;
      }
    }
  }

  if (!firstPhoto && Array.isArray(p.ornate?.ornateImages)) {
    for (const img of p.ornate.ornateImages) {
      const u = typeof img === 'string' ? img : img?.url;
      if (u && typeof u === 'string' && u.trim() && !/\.(mp4|webm|mov)(?:[?#]|$)/i.test(u)) {
        firstPhoto = u.trim();
        break;
      }
    }
  }

  if (!firstPhoto && p.image) {
    const u = typeof p.image === 'string' ? p.image : p.image?.url;
    if (u && typeof u === 'string' && u.trim()) {
      firstPhoto = u.trim();
    }
  }

  // Format colorImages keeping only the 1st image photo for each color
  const formattedColorImages = Array.isArray(p.colorImages)
    ? p.colorImages
        .map((ci) => {
          if (!ci) return null;
          const validImgs = (ci.images || [])
            .filter((img) => img && (typeof img === 'string' || img?.mediaType !== 'video'))
            .map((img) => (typeof img === 'string' ? img : img?.url))
            .filter(Boolean);
          const photo = validImgs[0] || '';
          return {
            status: ci.status || 'active',
            metalColorId: ci.metalColorId || null,
            firstPhoto: photo,
            images: photo ? [{ url: photo, mediaType: 'image' }] : [],
          };
        })
        .filter(Boolean)
    : [];

  const resolvedCategory =
    Array.isArray(p.categoryIds) && p.categoryIds.length > 0 ? p.categoryIds : [];

  return {
    _id: p._id,
    id: p._id,
    title,
    sku,
    price: effectivePrice,
    basicInfo: p.basicInfo || {},
    pricing: String(p.productType || '').toLowerCase() === 'gold' && p.pricing
      ? { ...p.pricing, mrp: p.pricing.salePrice || effectivePrice }
      : (p.pricing || {}),
    categoryIds: resolvedCategory,
    status: p.status || 'draft',
    colorImages: formattedColorImages,
    firstPhoto,
    thumbnail: firstPhoto,
    productType: p.productType || '',
    isOrnate: Boolean(p.isOrnate),
    ornate: p.ornate || {},
  };
};

/**
 * Builds MongoDB search query filter for product listing/catalogue
 */
const buildProductSearchFilter = (search) => {
  if (!search || !String(search).trim()) return null;
  const searchRegex = new RegExp(String(search).trim(), 'i');
  return [
    { 'basicInfo.title': searchRegex },
    { 'basicInfo.sku': searchRegex },
    { 'ornate.tagNo': searchRegex },
    { 'ornate.barcode': searchRegex },
    { 'ornate.itemCode': searchRegex },
    { 'ornate.groupName': searchRegex },
    { 'ornate.customGroupName': searchRegex },
  ];
};

/**
 * Builds productType filter for catalogue
 */
const buildProductTypeFilter = (productType, isOrnateSpecified = false) => {
  if (!productType) return null;
  const pt = String(productType).toLowerCase();
  if (pt === 'gold') {
    return { productType: 'gold' };
  }
  if (pt === 'silver') {
    return isOrnateSpecified
      ? { productType: 'silver' }
      : { productType: 'silver', isOrnate: { $ne: true } };
  }
  return { productType: pt };
};

/**
 * Builds productType filter specifically for lookup modal
 */
const buildLookupProductTypeFilter = (productType, isOrnateSpecified = false) => {
  if (!productType || productType === 'all') return null;
  const pt = String(productType).toLowerCase();
  if (pt === 'gold') {
    return { productType: 'gold' };
  }
  if (pt === 'silver') {
    return isOrnateSpecified
      ? { productType: 'silver' }
      : { productType: 'silver', isOrnate: { $ne: true } };
  }
  if (pt === 'ornate') {
    return { isOrnate: true };
  }
  return { productType: pt };
};

/**
 * Returns the MongoDB $cond expression for positive price precedence (salePrice fallback to mrp)
 */
const getEffectivePriceExpression = () => {
  return ['pricing.salePrice', 'pricing.mrp'].reduceRight(
    (fallback, field) => ({ $cond: [{ $gt: [`$${field}`, 0] }, `$${field}`, fallback] }),
    null
  );
};

/**
 * Builds price range conditions against the effective price expression
 */
const buildPriceRangeConditions = (queryParams, effectivePrice) => {
  const priceConditions = [];
  for (const [parameter, operator] of [['minPrice', '$gte'], ['maxPrice', '$lte']]) {
    if (queryParams[parameter] !== undefined && queryParams[parameter] !== '') {
      const value = Number(queryParams[parameter]);
      if (!Number.isFinite(value) || value < 0) {
        throw new ApiError(400, 'Price must be a non-negative number');
      }
      priceConditions.push({ [operator]: [effectivePrice, value] });
    }
  }

  if (queryParams.minPrice && queryParams.maxPrice && Number(queryParams.minPrice) > Number(queryParams.maxPrice)) {
    throw new ApiError(400, 'Maximum price must be greater than minimum price');
  }

  return priceConditions;
};

module.exports = {
  withColorStatuses,
  sanitizeColorImages,
  isPricingUnchanged,
  formatHomeProduct,
  formatStorefrontProduct,
  extractProductImages,
  extractMetalColors,
  formatColorImages,
  formatLookupProduct,
  buildProductSearchFilter,
  buildProductTypeFilter,
  buildLookupProductTypeFilter,
  getEffectivePriceExpression,
  buildPriceRangeConditions,
};
