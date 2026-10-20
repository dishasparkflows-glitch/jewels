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
const formatHomeProduct = (p) => {
  if (!p) return null;
  withColorStatuses(p);
  const salePrice = Number(p.pricing?.salePrice || 0);
  const mrp = Number(p.pricing?.mrp || 0);
  const price = salePrice > 0 ? salePrice : (mrp > 0 ? mrp : null);

  // Extract primary image
  let image = '';
  const images = [];

  if (Array.isArray(p.colorImages)) {
    p.colorImages.forEach((c) => {
      if (Array.isArray(c.images)) {
        c.images.forEach((img) => {
          const u = typeof img === 'string' ? img : img?.url;
          if (u && !u.toLowerCase().includes('ornate')) images.push(u);
        });
      }
    });
  }

  if (images.length > 0) {
    image = images[0];
  } else {
    image = '';
  }

  return {
    _id: p._id,
    id: p._id,
    basicInfo: p.basicInfo || {},
    pricing: p.pricing || {},
    cataloguePrice: price,
    image,
    colorImages: p.colorImages || [],
    metalColors: p.metalColorIds || [],
    metalColorIds: p.metalColorIds || [],
    category: p.categoryIds || [],
    productType: p.basicInfo?.productType || '',
    isOrnate: Boolean(p.basicInfo?.isOrnate),
    stockStatus: p.stockStatus || '',
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
    productType: p.basicInfo?.productType,
    isOrnate: Boolean(p.basicInfo?.isOrnate),
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
const buildProductTypeFilter = (productType) => {
  if (!productType) return null;
  const pt = String(productType).toLowerCase();
  let typeMatcher;
  if (pt === 'jewelry' || pt === 'gold') {
    typeMatcher = { $in: ['gold', 'jewelry', 'Gold', 'Jewelry'] };
  } else if (pt === 'silver' || pt === 'standard') {
    typeMatcher = { $in: ['silver', 'standard', 'Silver', 'Standard'] };
  } else {
    typeMatcher = productType;
  }
  return { $or: [{ 'basicInfo.productType': typeMatcher }, { productType: typeMatcher }] };
};

/**
 * Builds productType filter specifically for lookup modal
 */
const buildLookupProductTypeFilter = (productType) => {
  if (!productType || productType === 'all') return null;
  const pt = String(productType).toLowerCase();
  if (pt === 'gold' || pt === 'jewelry') {
    return {
      $and: [
        {
          $or: [
            { 'basicInfo.productType': { $in: ['gold', 'jewelry', 'Gold', 'Jewelry'] } },
            { 'ornate.metalName': new RegExp('gold', 'i') },
            { 'basicInfo.title': new RegExp('gold', 'i') },
          ],
        },
        { 'basicInfo.isOrnate': { $ne: true } },
      ],
    };
  } else if (pt === 'silver' || pt === 'standard') {
    return {
      $or: [
        { 'basicInfo.productType': { $in: ['silver', 'Silver', 'standard', 'Standard'] } },
        { 'ornate.metalName': new RegExp('silver', 'i') },
        { 'basicInfo.title': new RegExp('silver|925', 'i') },
      ],
    };
  } else if (pt === 'ornate') {
    return {
      $or: [{ 'basicInfo.isOrnate': true }, { 'basicInfo.productType': 'ornate' }],
    };
  } else {
    return {
      'basicInfo.productType': productType,
    };
  }
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
  formatLookupProduct,
  buildProductSearchFilter,
  buildProductTypeFilter,
  buildLookupProductTypeFilter,
  getEffectivePriceExpression,
  buildPriceRangeConditions,
};
