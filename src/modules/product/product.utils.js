const mongoose = require('mongoose');
const ApiError = require('../../utils/ApiError');

// Lean and aggregate results do not apply schema defaults to existing records.
const withColorStatuses = (product) => {
  if (!product) return product;
  if (Array.isArray(product.colorImages)) {
    product.colorImages = product.colorImages.map((color) => ({
      ...color,
      status: color.status ?? 'active',
    }));
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

/**
 * Format storefront products (returning only images, title, basicInfo, pricing, etc.)
 */
const formatStorefrontProduct = (p) => {
  if (!p) return null;
  const isGroup = Boolean(p.isGroup);
  const title = p.basicInfo?.title || p.groupName || p.name || 'Untitled product';
  const slug = p.basicInfo?.slug || p.slug || '';
  const description = p.basicInfo?.description || p.description || '';
  const images = extractProductImages(p);

  const salePrice = Number(p.pricing?.salePrice || 0);
  const mrp = Number(p.pricing?.mrp || salePrice || 0);
  const minPrice = Number(p.pricing?.minPrice || salePrice || 0);
  const maxPrice = Number(p.pricing?.maxPrice || mrp || salePrice || 0);

  return {
    _id: p._id,
    id: p._id,
    title,
    slug,
    images,
    basicInfo: {
      title,
      slug,
      description,
    },
    pricing: {
      salePrice,
      mrp,
      minPrice,
      maxPrice,
    },
    isGroup,
    variantCount: p.variantCount || 0,
    ...(p.categoryIds ? { categoryIds: p.categoryIds } : {}),
  };
};

const formatHomeProduct = (p) => {
  if (!p) return null;
  const isGroup = Boolean(p.isGroup);
  const title = p.basicInfo?.title || p.groupName || p.name || 'Untitled product';
  const slug = p.basicInfo?.slug || p.slug || '';
  const description = p.basicInfo?.description || p.description || '';
  const images = extractProductImages(p);

  const salePrice = Number(p.pricing?.salePrice || 0);
  const mrp = Number(p.pricing?.mrp || salePrice || 0);
  const minPrice = Number(p.pricing?.minPrice || salePrice || 0);
  const maxPrice = Number(p.pricing?.maxPrice || mrp || salePrice || 0);

  return {
    _id: p._id,
    id: p._id,
    title,
    slug,
    images,
    image: images[0] || '',
    basicInfo: {
      title,
      slug,
      description,
    },
    pricing: {
      salePrice,
      mrp,
      minPrice,
      maxPrice,
    },
    isGroup,
    variantCount: p.variantCount || 0,
    productType: p.productType || '',
    isOrnate: Boolean(p.isOrnate),
    stockStatus: p.stockStatus || '',
    ...(p.categoryIds ? { categoryIds: p.categoryIds } : {}),
  };
};

/**
 * Helper to format product lookup results for dropdowns / admin selection
 */
const formatLookupProduct = (p) => {
  if (!p) return null;
  withColorStatuses(p);
  const derivedImages = (p.colorImages || []).flatMap((color) => color.images || []);
  const thumb =
    derivedImages?.[0]?.url ||
    p.ornate?.ornateImages?.[0]?.url ||
    '';

  const effectivePrice = Number(p.pricing?.salePrice || p.pricing?.mrp || 0);

  const resolvedCategory =
    Array.isArray(p.categoryIds) && p.categoryIds.length > 0 ? p.categoryIds : [];

  return {
    _id: p._id,
    id: p._id,
    basicInfo: p.basicInfo || {},
    pricing: p.pricing || {},
    ornate: p.ornate || {},
    category: resolvedCategory,
    productType: p.productType || '',
    isOrnate: Boolean(p.isOrnate),
    cataloguePrice: effectivePrice,
    status: p.status,
    colorImages: p.colorImages || [],
    thumbnail: thumb,
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
  formatLookupProduct,
  buildProductSearchFilter,
  buildProductTypeFilter,
  buildLookupProductTypeFilter,
  getEffectivePriceExpression,
  buildPriceRangeConditions,
};
