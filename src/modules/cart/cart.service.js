const mongoose = require('mongoose');
const Cart = require('./cart.model');
const Product = require('../product/product.model');
const Wishlist = require('../wishlist/wishlist.model');
const ApiError = require('../../utils/ApiError');

class CartService {
  /**
   * Helper: Find existing cart by userId
   */
  async findOrCreateCart(userId) {
    if (!userId) {
      return null;
    }

    let userCart = await Cart.findOne({
      $or: [{ user: userId }, { userId }],
      'meta.deletedAt': null,
    });

    if (userCart) {
      return userCart;
    }

    // Create brand new cart
    const newCart = new Cart({
      user: userId,
      userId: userId,
      items: [],
    });

    await newCart.save();
    return newCart;
  }

  /**
   * Format cart output with calculated totals
   */
  formatCart(cart) {
    if (!cart) {
      return {
        cartId: null,
        userId: null,
        items: [],
        totalItems: 0,
        subtotal: 0,
        shipping: 0,
        tax: 0,
        total: 0,
      };
    }

    const items = cart.items || [];
    const totalItems = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
    const subtotal = items.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
      0
    );
    const shipping = subtotal > 5000 || subtotal === 0 ? 0 : 250;
    const tax = Math.round(subtotal * 0.03); // 3% GST on fine jewellery in India
    const total = subtotal + shipping + tax;

    return {
      cartId: cart._id,
      userId: cart.userId || cart.user || null,
      items: items.map((item) => ({
        _id: item._id,
        productId: String(item.productId),
        title: item.title,
        slug: item.slug || item.product?.basicInfo?.slug || (item.title ? item.title.toLowerCase().trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') : ''),
        price: item.price,
        totalItemPrice: item.totalItemPrice || ((item.price || 0) * (item.quantity || 1)),
        originalPrice: item.originalPrice,
        image: item.image,
        category: item.category,
        quantity: item.quantity,
        selectedMetal: item.selectedMetal || '',
        selectedSize: item.selectedSize || '',
        selectedAttributes: item.selectedAttributes || undefined,
        itemTotal: item.totalItemPrice || ((item.price || 0) * (item.quantity || 1)),
        addedAt: item.addedAt,
      })),
      totalItems,
      subtotal,
      shipping,
      tax,
      total,
    };
  }

  /**
   * Get current cart
   */
  async getCart({ userId } = {}) {
    if (!userId) {
      return this.formatCart(null);
    }

    const cart = await this.findOrCreateCart(userId);
    if (!cart) {
      return this.formatCart(null);
    }

    await cart.populate({
      path: 'items.product',
      select: 'basicInfo title price images category sku status metalColorIds colorImages metalColors',
    });

    return this.formatCart(cart);
  }

  /**
   * Add item to cart
   */
  async addToCart({ userId, productData, quantity = 1, options = {} } = {}) {
    if (!productData || (!productData.productId && !productData.id && !productData._id)) {
      throw new ApiError(400, 'Product ID is required');
    }

    if (!userId) {
      throw new ApiError(401, 'Please log in to add items to your cart');
    }

    const productIdStr = String(productData.productId || productData.id || productData._id).trim();
    const parsedQty = Math.max(1, parseInt(quantity, 10) || 1);
    const selectedMetal = options.selectedMetal || productData.selectedMetal || '';
    const selectedSize = options.selectedSize || productData.selectedSize || '';
    const addedAt = productData.addedAt ? new Date(productData.addedAt) : new Date();

    const cart = await this.findOrCreateCart(userId);
    if (!cart) {
      throw new ApiError(500, 'Failed to initialize cart');
    }

    cart.userId = userId;
    cart.user = userId;

    let productRef = null;
    let found = null;
    if (mongoose.Types.ObjectId.isValid(productIdStr)) {
      found = await Product.findById(productIdStr).lean();
      if (found) {
        productRef = found._id;
        if (!productData.title) productData.title = found.basicInfo?.title;
        if (!productData.price) productData.price = found.pricing?.salePrice || found.pricing?.mrp;
        if (!productData.image) {
          const firstImg =
            found.colorImages?.[0]?.images?.[0] ||
            found.ornate?.ornateImages?.[0] ||
            found.images?.[0];
          productData.image = typeof firstImg === 'string' ? firstImg : firstImg?.url || '';
        }
      }
    }

    const price = Number(productData.price) || 0;
    const totalItemPrice = Number(productData.totalItemPrice) || (price * parsedQty);

    // Resolve selectedAttributes for gold products if needed
    const isGold = (found?.productType === 'gold') || (productData.productType === 'gold');
    let selectedAttributes = options.selectedAttributes || productData.selectedAttributes || null;

    if (isGold || selectedAttributes) {
      const firstVariant = found?.variants?.[0] || null;
      const firstCenterRow = found?.centerDiamondRows?.[0] || null;

      const toObjectId = (val) => (val && mongoose.isValidObjectId(val) ? new mongoose.Types.ObjectId(val) : null);

      selectedAttributes = {
        metalPurity: toObjectId(selectedAttributes?.metalPurity || firstVariant?.metalPurityId || found?.metalPurityIds?.[0]),
        metalColor: toObjectId(selectedAttributes?.metalColor || firstVariant?.metalColorId || found?.metalColorIds?.[0]),
        diamondType: toObjectId(selectedAttributes?.diamondType || firstVariant?.diamondTypeId || firstCenterRow?.diamondTypeId),
        diamondShape: toObjectId(selectedAttributes?.diamondShape || firstVariant?.diamondShapeId || firstCenterRow?.diamondShapeId),
        diamondClarity: toObjectId(selectedAttributes?.diamondClarity || firstVariant?.diamondClarityId || firstCenterRow?.diamondClarityId),
        diamondColor: toObjectId(selectedAttributes?.diamondColor || firstVariant?.diamondColorId || firstCenterRow?.diamondColorId),
        caratWeight: Number(selectedAttributes?.caratWeight ?? firstVariant?.caratWeight ?? firstCenterRow?.caratWeight ?? 1.5),
        size: toObjectId(selectedAttributes?.size),
        sizeRange: selectedAttributes?.sizeRange || (typeof selectedAttributes?.size === 'string' && !mongoose.isValidObjectId(selectedAttributes.size) ? selectedAttributes.size : null),
      };
    }

    // Check if this product & metal combination or matching variant exists in cart
    const existingIndex = cart.items.findIndex((item) => {
      const sameProduct = String(item.productId) === productIdStr;
      if (!sameProduct) return false;
      if (selectedAttributes?.metalColor && item.selectedAttributes?.metalColor) {
        if (String(item.selectedAttributes.metalColor) !== String(selectedAttributes.metalColor)) return false;
      }
      if (selectedAttributes?.size && item.selectedAttributes?.size) {
        if (String(item.selectedAttributes.size) !== String(selectedAttributes.size)) return false;
      }
      return true;
    });

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += parsedQty;
      cart.items[existingIndex].totalItemPrice =
        (Number(cart.items[existingIndex].price) || price) * cart.items[existingIndex].quantity;
      if (selectedMetal) {
        cart.items[existingIndex].selectedMetal = selectedMetal;
      }
      if (selectedAttributes) {
        cart.items[existingIndex].selectedAttributes = selectedAttributes;
      }
    } else {
      cart.items.push({
        product: productRef,
        productId: productIdStr,
        title: productData.title || found?.basicInfo?.title || '',
        price,
        totalItemPrice,
        originalPrice: productData.originalPrice ? Number(productData.originalPrice) : (found?.pricing?.mrp || null),
        image: productData.image || (found?.colorImages?.[0]?.images?.[0]?.url || found?.ornate?.ornateImages?.[0]?.url || ''),
        category: productData.category || (found?.categoryIds?.[0] ? String(found.categoryIds[0]) : ''),
        quantity: parsedQty,
        selectedMetal: selectedMetal || '',
        selectedSize: selectedSize || (selectedAttributes?.size ? String(selectedAttributes.size) : ''),
        ...(selectedAttributes ? { selectedAttributes } : {}),
        addedAt,
      });
    }

    await cart.save();
    return this.formatCart(cart);
  }

  /**
   * Update item quantity
   */
  async updateQuantity({ userId, productId, quantity, options = {} } = {}) {
    if (!productId) {
      throw new ApiError(400, 'Product ID is required');
    }
    if (!userId) {
      throw new ApiError(401, 'Please log in to update cart items');
    }

    const productIdStr = String(productId).trim();
    const newQty = parseInt(quantity, 10);
    const cart = await this.findOrCreateCart(userId);
    if (!cart) {
      throw new ApiError(404, 'Cart not found');
    }

    const index = cart.items.findIndex(
      (item) =>
        String(item.productId) === productIdStr || String(item._id) === productIdStr
    );

    if (index === -1) {
      throw new ApiError(404, 'Item not found in cart');
    }

    if (newQty <= 0) {
      cart.items.splice(index, 1);
    } else {
      cart.items[index].quantity = newQty;
    }

    await cart.save();
    return this.formatCart(cart);
  }

  /**
   * Remove item from cart
   */
  async removeItem({ userId, productId } = {}) {
    if (!productId) {
      throw new ApiError(400, 'Product ID is required');
    }
    if (!userId) {
      throw new ApiError(401, 'Please log in to remove cart items');
    }

    const productIdStr = String(productId).trim();
    const cart = await this.findOrCreateCart(userId);
    if (!cart) {
      return this.formatCart(null);
    }

    cart.items = cart.items.filter(
      (item) =>
        String(item.productId) !== productIdStr && String(item._id) !== productIdStr
    );

    await cart.save();
    return this.formatCart(cart);
  }

  /**
   * Clear cart
   */
  async clearCart({ userId } = {}) {
    if (!userId) {
      return this.formatCart(null);
    }
    const cart = await this.findOrCreateCart(userId);
    if (cart) {
      cart.items = [];
      await cart.save();
      return this.formatCart(cart);
    }
    return this.formatCart(null);
  }

  /**
   * Fast badge counts for Cart & Wishlist without populating product data
   */
  async getCounts({ userId } = {}) {
    let cartCount = 0;
    let wishlistCount = 0;

    if (userId) {
      const cart = await Cart.findOne({
        $or: [{ user: userId }, { userId }],
        'meta.deletedAt': null,
      }).select('items.quantity').lean();

      if (cart?.items && Array.isArray(cart.items)) {
        cartCount = cart.items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
      }

      const wishlist = await Wishlist.findOne({ userId, 'meta.deletedAt': null })
        .select('productIds')
        .lean();
      if (wishlist?.productIds && Array.isArray(wishlist.productIds)) {
        wishlistCount = wishlist.productIds.length;
      }
    }

    return {
      cartCount,
      wishlistCount,
      totalItems: cartCount,
    };
  }
}

module.exports = new CartService();
