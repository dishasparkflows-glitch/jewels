const Wishlist = require('./wishlist.model');
const ApiError = require('../../utils/ApiError');

class WishlistService {
  /**
   * Helper: Find existing wishlist by userId
   */
  async findOrCreateWishlist(userId) {
    if (!userId) {
      throw new ApiError(400, 'User ID is required to manage wishlist');
    }

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = await Wishlist.create({
        userId,
        items: [],
      });
    }

    return wishlist;
  }

  /**
   * Get wishlist items for user
   */
  async getWishlist(userId) {
    if (!userId) {
      return { items: [], count: 0, wishlistId: null };
    }

    const wishlist = await this.findOrCreateWishlist(userId);
    if (!wishlist) {
      return { items: [], count: 0, wishlistId: null };
    }

    return {
      items: wishlist.items || [],
      count: wishlist.items?.length || 0,
      wishlistId: wishlist._id,
    };
  }

  /**
   * Toggle item in wishlist (add if not present, remove if present)
   */
  async toggleItem({ userId, productData }) {
    if (!productData || !productData.productId) {
      throw new ApiError(400, 'Product ID is required');
    }

    const productIdStr = String(productData.productId).trim();
    const wishlist = await this.findOrCreateWishlist(userId);

    // Check if item already in wishlist
    const existingIndex = wishlist.items.findIndex(
      (item) => String(item.productId) === productIdStr || String(item._id) === productIdStr
    );

    let isWishlisted = false;

    if (existingIndex > -1) {
      // Remove item
      wishlist.items.splice(existingIndex, 1);
      isWishlisted = false;
    } else {
      wishlist.items.push({
        productId: productIdStr,
        title: productData.title || '',
        price: Number(productData.price) || 0,
        originalPrice: productData.originalPrice ? Number(productData.originalPrice) : null,
        image: productData.image || '',
        category: productData.category || '',
        slug: productData.slug || '',
        addedAt: new Date(),
      });
      isWishlisted = true;
    }

    await wishlist.save();

    return {
      isWishlisted,
      count: wishlist.items.length,
      productId: productIdStr,
      items: wishlist.items,
    };
  }

  /**
   * Add item specifically
   */
  async addItem({ userId, productData }) {
    if (!productData || !productData.productId) {
      throw new ApiError(400, 'Product ID is required');
    }
    const productIdStr = String(productData.productId).trim();
    const wishlist = await this.findOrCreateWishlist(userId);

    const exists = wishlist.items.some((item) => String(item.productId) === productIdStr);
    if (!exists) {
      wishlist.items.push({
        productId: productIdStr,
        title: productData.title || '',
        price: Number(productData.price) || 0,
        originalPrice: productData.originalPrice ? Number(productData.originalPrice) : null,
        image: productData.image || '',
        category: productData.category || '',
        slug: productData.slug || '',
        addedAt: new Date(),
      });
      await wishlist.save();
    }

    return {
      count: wishlist.items.length,
      items: wishlist.items,
    };
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

    const initialLength = wishlist.items.length;
    wishlist.items = wishlist.items.filter(
      (item) => String(item.productId) !== productIdStr && String(item._id) !== productIdStr
    );

    if (wishlist.items.length !== initialLength) {
      await wishlist.save();
    }

    return {
      count: wishlist.items.length,
      items: wishlist.items,
    };
  }

  /**
   * Clear all items from wishlist
   */
  async clearWishlist(userId) {
    const wishlist = await this.findOrCreateWishlist(userId);
    wishlist.items = [];
    await wishlist.save();
    return { count: 0, items: [] };
  }
}

module.exports = new WishlistService();
