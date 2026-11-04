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

  const primaryImage = formatted.image || (Array.isArray(formatted.images) && formatted.images[0]) || '';

  // Return clean metal colors needed for card swatches without redundant nested arrays
  const metalColors = (formatted.metalColors || []).map((mc) => ({
    _id: mc._id || mc.id,
    name: mc.name || '',
    colorCode: mc.colorCode || mc.hex || '',
    colorCodeEnd: mc.colorCodeEnd || '',
    hex: mc.hex || mc.colorCode || '',
    firstPhoto: mc.firstPhoto || (Array.isArray(mc.images) ? mc.images[0] : '') || '',
  }));

  return {
    _id: formatted._id,
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
    image: primaryImage,
    metalColors,
    productType: formatted.productType || 'gold',
    isOrnate: Boolean(formatted.isOrnate),
    stockStatus: formatted.stockStatus || 'in_stock',
  };
}

class WishlistService {
  // ------------------------------- format wishlist ----------------------------
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

  // ------------------------------- find or create wishlist ----------------------------
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

  // ------------------------------- get count ----------------------------
  async getCount(userId) {
    if (!userId) return { count: 0, wishlistCount: 0 };
    const wishlist = await Wishlist.findOne({ userId }).select('productIds').lean();
    const count = wishlist?.productIds?.length || 0;
    return { count, wishlistCount: count };
  }

  // ------------------------------- get wishlist ----------------------------
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

  // ------------------------------- toggle item in wishlist ----------------------------
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

    return {
      isWishlisted,
      wishlistCount: wishlist.productIds.length,
    };
  }

  // ------------------------------- add item to wishlist ----------------------------
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

  // ------------------------------- remove item from wishlist ----------------------------
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

  // ------------------------------- clear wishlist ----------------------------
  async clearWishlist(userId) {
    const wishlist = await this.findOrCreateWishlist(userId);
    wishlist.productIds = [];
    await wishlist.save();
    return this.formatWishlist(wishlist);
  }
}

module.exports = new WishlistService();
