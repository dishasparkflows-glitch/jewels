const mongoose = require('mongoose');
const Product = require('./product.model');
const ProductGroup = require('../productGroup/productGroup.model');
const Wishlist = require('../wishlist/wishlist.model');
const cloudflareR2 = require('../../utils/cloudflareR2');
const { getProductPopulateOptions, buildProductSearchFilter, buildProductTypeFilter } = require('./product.utils');

/**
 * Resolves a product by ObjectId, slug, sku, or ornate tagNo.
 * Supports fallback to stripped sequence slugs and product groups.
 */
async function resolveProductByCodeOrId(codeOrId, populateOptions = null) {
  const isObjectId = mongoose.Types.ObjectId.isValid(codeOrId);
  const filter = isObjectId
    ? {
        $or: [
          { _id: codeOrId },
          { 'basicInfo.slug': codeOrId },
          { 'basicInfo.sku': codeOrId },
          { 'ornate.tagNo': codeOrId },
        ],
      }
    : {
        $or: [
          { 'basicInfo.slug': codeOrId },
          { 'basicInfo.sku': codeOrId },
          { 'ornate.tagNo': codeOrId },
        ],
      };

  const popOptions = populateOptions || getProductPopulateOptions();

  let query = Product.findOne(filter);
  for (const pop of popOptions) {
    query = query.populate(pop);
  }
  let product = await query.lean();

  // Fallback 1: If not found and id ends with group sequence (e.g. -000030), try stripping the sequence
  if (!product && typeof codeOrId === 'string' && /-\d{6}$/.test(codeOrId)) {
    const strippedSlug = codeOrId.replace(/-\d{6}$/, '');
    let fallbackQuery = Product.findOne({ 'basicInfo.slug': strippedSlug });
    for (const pop of popOptions) {
      fallbackQuery = fallbackQuery.populate(pop);
    }
    product = await fallbackQuery.lean();
  }

  // Fallback 2: Check ProductGroup by slug, groupCode, or _id
  if (!product) {
    const groupFilter = isObjectId
      ? { $or: [{ _id: codeOrId }, { slug: codeOrId }, { groupCode: codeOrId }], 'meta.deletedAt': null }
      : { $or: [{ slug: codeOrId }, { groupCode: codeOrId }], 'meta.deletedAt': null };
    const group = await ProductGroup.findOne(groupFilter).lean();
    if (group) {
      const targetProdId = group.primaryProductId || (Array.isArray(group.productIds) ? group.productIds[0] : null);
      if (targetProdId) {
        let groupProductQuery = Product.findOne({ _id: targetProdId });
        for (const pop of popOptions) {
          groupProductQuery = groupProductQuery.populate(pop);
        }
        product = await groupProductQuery.lean();
      }
    }
  }

  return product;
}

/**
 * Returns a Set of product ID strings wishlisted by the user
 */
async function getWishlistSet(userId) {
  if (!userId) return new Set();
  try {
    const wishlist = await Wishlist.findOne({ userId, 'meta.deletedAt': null }).select('productIds').lean();
    if (!wishlist?.productIds || !Array.isArray(wishlist.productIds)) return new Set();
    return new Set(wishlist.productIds.map((p) => String(p._id || p)));
  } catch {
    return new Set();
  }
}

/**
 * Fetches and caches media file sizes using Cloudflare R2 metadata
 */
async function populateMediaSizes(product) {
  if (!product) return;
  let hasUpdates = false;

  if (Array.isArray(product.colorImages)) {
    for (const colorGroup of product.colorImages) {
      if (Array.isArray(colorGroup.images)) {
        await Promise.all(
          colorGroup.images.map(async (img) => {
            if ((!img.fileSize || !img.size) && (img.key || img.url)) {
              try {
                const meta = await cloudflareR2.getFileMetadata(img.key || img.url);
                if (meta && meta.fileSize) {
                  img.fileSize = meta.fileSize;
                  img.size = meta.size;
                  img.allowCompression = meta.allowCompression;
                  hasUpdates = true;
                }
              } catch {
                // ignore
              }
            } else if (img.fileSize && !img.size) {
              const isKb = img.fileSize < 1024 * 1024;
              img.size = isKb ? `${Math.round(img.fileSize / 1024)} KB` : `${(img.fileSize / (1024 * 1024)).toFixed(1)} MB`;
              img.allowCompression = !isKb;
            }
          })
        );
      }
    }
  }

  if (Array.isArray(product.ornate?.ornateImages)) {
    await Promise.all(
      product.ornate.ornateImages.map(async (img) => {
        if ((!img.fileSize || !img.size) && (img.key || img.url)) {
          try {
            const meta = await cloudflareR2.getFileMetadata(img.key || img.url);
            if (meta && meta.fileSize) {
              img.fileSize = meta.fileSize;
              img.size = meta.size;
              img.allowCompression = meta.allowCompression;
              hasUpdates = true;
            }
          } catch {
            // ignore
          }
        }
      })
    );
  }

  if (hasUpdates && product._id) {
    try {
      await Product.updateOne(
        { _id: product._id },
        {
          $set: {
            ...(product.colorImages ? { colorImages: product.colorImages } : {}),
            ...(product.ornate?.ornateImages ? { 'ornate.ornateImages': product.ornate.ornateImages } : {}),
          },
        }
      );
    } catch (err) {
      console.warn('[ProductQuery] Failed to persist media sizes:', err.message);
    }
  }
}

/**
 * Builds administrative listing filters for product catalog management
 */
function buildAdminFilter(queryParams) {
  const filter = { 'meta.deletedAt': null };

  if (queryParams.search) {
    const searchConditions = buildProductSearchFilter(queryParams.search);
    if (searchConditions) filter.$or = searchConditions;
  }

  const isOrnateSpecified = queryParams.isOrnate !== undefined && queryParams.isOrnate !== '';
  if (queryParams.productType) {
    const typeCondition = buildProductTypeFilter(queryParams.productType, isOrnateSpecified);
    if (typeCondition) {
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, typeCondition];
        delete filter.$or;
      } else {
        Object.assign(filter, typeCondition);
      }
    }
  }

  if (isOrnateSpecified) {
    filter.isOrnate = queryParams.isOrnate === 'true';
  }

  if (queryParams.category) {
    filter.categoryIds = queryParams.category;
  }

  if (queryParams.status && queryParams.status !== 'all') {
    filter.status = queryParams.status;
  }

  return filter;
}

module.exports = {
  resolveProductByCodeOrId,
  getWishlistSet,
  populateMediaSizes,
  buildAdminFilter,
};
