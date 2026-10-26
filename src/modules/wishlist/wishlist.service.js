const mongoose = require('mongoose');
const Wishlist = require('./wishlist.model');
const ApiError = require('../../utils/ApiError');

class WishlistService {
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

    const wishlist = await Wishlist.findOne({ userId }).populate('productIds');
    if (!wishlist) {
      return this.findOrCreateWishlist(userId);
    }

    return wishlist;
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
    await wishlist.populate('productIds');

    return {
      isWishlisted,
      ...wishlist.toObject(),
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
    return wishlist;
  }
}

module.exports = new WishlistService();
