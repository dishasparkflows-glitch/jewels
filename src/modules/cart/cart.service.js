const mongoose = require('mongoose');
const Cart = require('./cart.model');
const Product = require('../product/product.model');
const ApiError = require('../../utils/ApiError');

class CartService {
  /**
   * Helper: Find existing cart by userId or sessionId
   * If both exist, merge guest items into user cart
   */
  async findOrCreateCart(userId, sessionId) {
    if (!userId && !sessionId) {
      throw new ApiError(400, 'User ID or Session ID is required to manage cart');
    }

    let userCart = null;
    let sessionCart = null;

    if (userId) {
      userCart = await Cart.findOne({ user: userId });
    }

    if (sessionId) {
      sessionCart = await Cart.findOne({ sessionId });
    }

    // Merge session cart into user cart if user is authenticated
    if (userCart && sessionCart && String(userCart._id) !== String(sessionCart._id)) {
      for (const guestItem of sessionCart.items) {
        const existingIndex = userCart.items.findIndex(
          (item) =>
            String(item.productId) === String(guestItem.productId) &&
            (item.selectedMetal || '') === (guestItem.selectedMetal || '')
        );

        if (existingIndex > -1) {
          userCart.items[existingIndex].quantity += guestItem.quantity;
        } else {
          userCart.items.push(guestItem);
        }
      }
      await userCart.save();
      await Cart.deleteOne({ _id: sessionCart._id });
      return userCart;
    }

    if (userCart) {
      return userCart;
    }

    if (sessionCart) {
      if (userId) {
        sessionCart.user = userId;
        await sessionCart.save();
      }
      return sessionCart;
    }

    // Create brand new cart
    const newCart = new Cart({
      user: userId || null,
      sessionId: sessionId || null,
      items: [],
    });

    await newCart.save();
    return newCart;
  }

  /**
   * Format cart output with calculated totals
   */
  formatCart(cart) {
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
      items: items.map((item) => ({
        _id: item._id,
        productId: String(item.productId),
        title: item.title,
        price: item.price,
        originalPrice: item.originalPrice,
        image: item.image,
        category: item.category,
        quantity: item.quantity,
        selectedMetal: item.selectedMetal,
        selectedSize: item.selectedSize,
        itemTotal: (item.price || 0) * (item.quantity || 1),
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
  async getCart({ userId, sessionId }) {
    if (!userId && !sessionId) {
      return {
        items: [],
        totalItems: 0,
        subtotal: 0,
        shipping: 0,
        tax: 0,
        total: 0,
      };
    }

    const cart = await this.findOrCreateCart(userId, sessionId);
    await cart.populate({
      path: 'items.product',
      select: 'title price images category sku status',
    });

    return this.formatCart(cart);
  }

  /**
   * Add item to cart
   */
  async addToCart({ userId, sessionId, productData, quantity = 1, options = {} }) {
    if (!productData || !productData.productId) {
      throw new ApiError(400, 'Product ID is required');
    }

    const productIdStr = String(productData.productId).trim();
    const parsedQty = Math.max(1, parseInt(quantity, 10) || 1);
    const selectedMetal = options.selectedMetal || productData.selectedMetal || '18K Yellow Gold';
    const selectedSize = options.selectedSize || productData.selectedSize || '';

    const cart = await this.findOrCreateCart(userId, sessionId);

    // Check if this product & metal combination already exists in cart
    const existingIndex = cart.items.findIndex(
      (item) =>
        String(item.productId) === productIdStr &&
        (item.selectedMetal || '') === selectedMetal
    );

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += parsedQty;
    } else {
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

      cart.items.push({
        product: productRef,
        productId: productIdStr,
        title: productData.title || productData.name || 'Fine Jewellery Piece',
        price: Number(productData.price) || 0,
        originalPrice: productData.originalPrice ? Number(productData.originalPrice) : null,
        image: productData.image || '',
        category: productData.category || '',
        quantity: parsedQty,
        selectedMetal,
        selectedSize,
        addedAt: new Date(),
      });
    }

    await cart.save();
    return this.formatCart(cart);
  }

  /**
   * Update item quantity
   */
  async updateQuantity({ userId, sessionId, productId, quantity, options = {} }) {
    if (!productId) {
      throw new ApiError(400, 'Product ID is required');
    }

    const productIdStr = String(productId).trim();
    const newQty = parseInt(quantity, 10);
    const cart = await this.findOrCreateCart(userId, sessionId);

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
  async removeItem({ userId, sessionId, productId }) {
    if (!productId) {
      throw new ApiError(400, 'Product ID is required');
    }

    const productIdStr = String(productId).trim();
    const cart = await this.findOrCreateCart(userId, sessionId);

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
  async clearCart({ userId, sessionId }) {
    const cart = await this.findOrCreateCart(userId, sessionId);
    cart.items = [];
    await cart.save();
    return this.formatCart(cart);
  }
}

module.exports = new CartService();
