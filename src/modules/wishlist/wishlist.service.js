const mongoose = require('mongoose');
const Wishlist = require('./wishlist.model');
const Product = require('../product/product.model');
const ApiError = require('../../utils/ApiError');

class WishlistService {
  /**
   * Helper: Find existing wishlist by userId or sessionId
   * If both exist, merge guest items into user wishlist
   */
  async findOrCreateWishlist(userId, sessionId) {
    if (!userId && !sessionId) {
      throw new ApiError(400, 'User ID or Session ID is required to manage wishlist');
    }

    let userWishlist = null;
    let sessionWishlist = null;

    if (userId) {
      userWishlist = await Wishlist.findOne({ user: userId });
    }

    if (sessionId) {
      sessionWishlist = await Wishlist.findOne({ sessionId });
    }

    // Merge session wishlist into user wishlist if user is authenticated
    if (userWishlist && sessionWishlist && String(userWishlist._id) !== String(sessionWishlist._id)) {
      const existingProductIds = new Set(userWishlist.items.map((i) => String(i.productId)));
      for (const item of sessionWishlist.items) {
        if (!existingProductIds.has(String(item.productId))) {
          userWishlist.items.push(item);
          existingProductIds.add(String(item.productId));
        }
      }
      await userWishlist.save();
      await Wishlist.deleteOne({ _id: sessionWishlist._id });
      return userWishlist;
    }

    if (userWishlist) {
      return userWishlist;
    }

    if (sessionWishlist) {
      // If user is now logged in, adopt the session wishlist
      if (userId) {
        sessionWishlist.user = userId;
        await sessionWishlist.save();
      }
      return sessionWishlist;
    }

    // Otherwise create brand new wishlist
    const newWishlist = new Wishlist({
      user: userId || null,
      sessionId: sessionId || null,
      items: [],
    });

    await newWishlist.save();
    return newWishlist;
  }

  /**
   * Get wishlist items for user or guest
   */
  async getWishlist({ userId, sessionId }) {
    if (!userId && !sessionId) {
      return { items: [], count: 0, wishlistId: null };
    }

    const wishlist = await this.findOrCreateWishlist(userId, sessionId);
    if (!wishlist) {
      return { items: [], count: 0, wishlistId: null };
    }

    // Populate product if referenced
    await wishlist.populate({
      path: 'items.product',
      select: 'title description price images category sku slug isOrnate',
    });

    // Format items to ensure unified schema
    const formattedItems = wishlist.items.map((item) => {
      const p = item.product;
      const imageUrl =
        item.image ||
        (p?.images?.[0]?.url || p?.images?.[0]) ||
        '';

      return {
        _id: item._id,
        productId: String(item.productId),
        title: item.title || p?.title || 'Jewellery Piece',
        price: item.price || p?.price || 0,
        originalPrice: item.originalPrice || p?.originalPrice || null,
        image: imageUrl,
        category: item.category || p?.category?.name || p?.category || 'Collection',
        slug: item.slug || p?.slug || '',
        addedAt: item.addedAt,
        inStock: p ? p.status !== 'out_of_stock' : true,
      };
    });

    return {
      items: formattedItems,
      count: formattedItems.length,
      wishlistId: wishlist._id,
    };
  }

  /**
   * Toggle item in wishlist (add if not present, remove if present)
   */
  async toggleItem({ userId, sessionId, productData }) {
    if (!productData || !productData.productId) {
      throw new ApiError(400, 'Product ID is required');
    }

    const productIdStr = String(productData.productId).trim();
    const wishlist = await this.findOrCreateWishlist(userId, sessionId);

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
      // Check if product exists in MongoDB collection
      let productRef = null;
      if (mongoose.Types.ObjectId.isValid(productIdStr)) {
        const found = await Product.findById(productIdStr).lean();
        if (found) {
          productRef = found._id;
          if (!productData.title) productData.title = found.title;
          if (!productData.price) productData.price = found.price;
          if (!productData.image && found.images?.[0]) {
            productData.image = typeof found.images[0] === 'string' ? found.images[0] : found.images[0]?.url;
          }
        }
      }

      wishlist.items.push({
        product: productRef,
        productId: productIdStr,
        title: productData.title || 'Jewellery Piece',
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
  async addItem({ userId, sessionId, productData }) {
    if (!productData || !productData.productId) {
      throw new ApiError(400, 'Product ID is required');
    }
    const productIdStr = String(productData.productId).trim();
    const wishlist = await this.findOrCreateWishlist(userId, sessionId);

    const exists = wishlist.items.some((item) => String(item.productId) === productIdStr);
    if (!exists) {
      let productRef = null;
      if (mongoose.Types.ObjectId.isValid(productIdStr)) {
        const found = await Product.findById(productIdStr).lean();
        if (found) productRef = found._id;
      }

      wishlist.items.push({
        product: productRef,
        productId: productIdStr,
        title: productData.title || '',
        price: Number(productData.price) || 0,
        originalPrice: productData.originalPrice ? Number(productData.originalPrice) : null,
        image: productData.image || '',
        category: productData.category || '',
        slug: productData.slug || '',
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
  async removeItem({ userId, sessionId, productId }) {
    if (!productId) {
      throw new ApiError(400, 'Product ID is required');
    }
    const productIdStr = String(productId).trim();
    const wishlist = await this.findOrCreateWishlist(userId, sessionId);

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
  async clearWishlist({ userId, sessionId }) {
    const wishlist = await this.findOrCreateWishlist(userId, sessionId);
    wishlist.items = [];
    await wishlist.save();
    return { count: 0, items: [] };
  }
}

module.exports = new WishlistService();
