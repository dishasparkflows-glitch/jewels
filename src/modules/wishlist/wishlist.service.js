const mongoose = require('mongoose');
const Wishlist = require('./wishlist.model');
const ApiError = require('../../utils/ApiError');
const { formatStorefrontProduct } = require('../product/product.utils');

const PRODUCT_POPULATE_CONFIG = {
  path: 'productIds',
  select: '_id basicInfo pricing colorImages metalColorIds productType isOrnate variants centerDiamondRows stockStatus categoryIds ornate.ornateImages',
  populate: {
    path: 'metalColorIds colorImages.metalColorId',
    select: 'name colorCode colorCodeEnd code hex',
  },
};

function formatWishlistProduct(p) {
  if (!p) return null;
  const formatted = formatStorefrontProduct(p);
  if (!formatted) return null;

  return {
    _id: formatted._id,
    id: formatted.id,
    basicInfo: {
      title: formatted.basicInfo?.title || formatted.title || '',
      slug: formatted.basicInfo?.slug || formatted.slug || '',
    },
    pricing: {
      salePrice: formatted.pricing?.salePrice || 0,
      mrp: formatted.pricing?.mrp || 0,
      ...(formatted.pricing?.minPrice ? { minPrice: formatted.pricing.minPrice } : {}),
      ...(formatted.pricing?.maxPrice ? { maxPrice: formatted.pricing.maxPrice } : {}),
    },
    images: formatted.images || [],
    image: formatted.image || (formatted.images && formatted.images[0]) || '',
    metalColors: formatted.metalColors || [],
    colorImages: formatted.colorImages || [],
    metalColorIds: formatted.metalColorIds || [],
    productType: formatted.productType || 'gold',
    isOrnate: Boolean(formatted.isOrnate),
    stockStatus: formatted.stockStatus || 'in_stock',
    ...(formatted.selectedAttributes ? { selectedAttributes: formatted.selectedAttributes } : {}),
    ...(formatted.categoryIds ? { categoryIds: formatted.categoryIds } : {}),
  };
}

class WishlistService {
  /**
   * Format wishlist payload with only needed product fields
   */
  formatWishlist(wishlistDoc) {
    if (!wishlistDoc) return null;
    const w = typeof wishlistDoc.toObject === 'function' ? wishlistDoc.toObject() : wishlistDoc;
    const rawList = Array.isArray(w.productIds) ? w.productIds : [];
    const formattedProducts = rawList
      .map(formatWishlistProduct)
      .filter(Boolean);

    return {
      _id: w._id,
      userId: w.userId,
      productIds: formattedProducts,
      addedAt: w.addedAt,
    };
  }

  /**
   * Helper: Find or create wishlist by userId
   */
  async findOrCreateWishlist(userId) {
    if (!userId) {
      throw new ApiError(400, 'User ID is required to manage wishlist');
    }

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = await Wishlist.create({
        userId,
        productIds: [],
        addedAt: new Date(),
      });
    }

    return wishlist;
  }

  /**
   * Fast count of wishlist items without populating
   */
  async getCount(userId) {
    if (!userId) return { count: 0, wishlistCount: 0 };
    const wishlist = await Wishlist.findOne({ userId }).select('productIds').lean();
    const count = wishlist?.productIds?.length || 0;
    return { count, wishlistCount: count };
  }

  /**
   * Get wishlist for user
   */
  async getWishlist(userId) {
    if (!userId) {
      return null;
    }

    const wishlist = await Wishlist.findOne({ userId }).populate(PRODUCT_POPULATE_CONFIG);
    if (!wishlist) {
      const created = await this.findOrCreateWishlist(userId);
      return this.formatWishlist(created);
    }

    return this.formatWishlist(wishlist);
  }

  /**
   * Toggle item in wishlist (add if not present, remove if present)
   */
  async toggleItem({ userId, productData }) {
    const productId = typeof productData === 'string' ? productData : productData?.productId;
    if (!productId) {
      throw new ApiError(400, 'Product ID is required');
    }

    const productIdStr = String(productId).trim();
    if (!mongoose.isValidObjectId(productIdStr)) {
      throw new ApiError(400, 'Invalid Product ID');
    }

    const wishlist = await this.findOrCreateWishlist(userId);

    const existingIndex = wishlist.productIds.findIndex(
      (id) => String(id) === productIdStr
    );

    let isWishlisted = false;
    if (existingIndex > -1) {
      wishlist.productIds.splice(existingIndex, 1);
      isWishlisted = false;
    } else {
      wishlist.productIds.push(productIdStr);
      wishlist.addedAt = new Date();
      isWishlisted = true;
    }

    await wishlist.save();
    await wishlist.populate(PRODUCT_POPULATE_CONFIG);
    const formattedWishlist = this.formatWishlist(wishlist);

    return {
      isWishlisted,
      ...formattedWishlist,
    };
  }

  /**
   * Add item specifically
   */
  async addItem({ userId, productData }) {
    const productId = typeof productData === 'string' ? productData : productData?.productId;
    if (!productId) {
      throw new ApiError(400, 'Product ID is required');
    }
    const productIdStr = String(productId).trim();
    if (!mongoose.isValidObjectId(productIdStr)) {
      throw new ApiError(400, 'Invalid Product ID');
    }

    const wishlist = await this.findOrCreateWishlist(userId);

    const exists = wishlist.productIds.some((id) => String(id) === productIdStr);
    if (!exists) {
      wishlist.productIds.push(productIdStr);
      wishlist.addedAt = new Date();
      await wishlist.save();
    }

    return this.getWishlist(userId);
  }

  /**
   * Remove item specifically
   */
  async removeItem({ userId, productId }) {
    if (!productId) {
      throw new ApiError(400, 'Product ID is required');
    }
    const productIdStr = String(productId).trim();
    const wishlist = await this.findOrCreateWishlist(userId);

    const initialLength = wishlist.productIds.length;
    wishlist.productIds = wishlist.productIds.filter(
      (id) => String(id) !== productIdStr
    );

    if (wishlist.productIds.length !== initialLength) {
      await wishlist.save();
    }

    return this.getWishlist(userId);
  }

  /**
   * Clear all items from wishlist
   */
  async clearWishlist(userId) {
    const wishlist = await this.findOrCreateWishlist(userId);
    wishlist.productIds = [];
    await wishlist.save();
    return this.formatWishlist(wishlist);
  }
}

module.exports = new WishlistService();
