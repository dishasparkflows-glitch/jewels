const mongoose = require('mongoose');
const Cart = require('./cart.model');
const Product = require('../product/product.model');
const Wishlist = require('../wishlist/wishlist.model');
const ApiError = require('../../utils/ApiError');

const cartPopulateOptions = [
  {
    path: 'items.productId',
    select: 'basicInfo pricing colorImages ornate images categoryIds productType variants centerDiamondRows',
    populate: { path: 'categoryIds', select: 'name' },
  },
  { path: 'items.selectedAttributes.metalPurity', select: 'name' },
  { path: 'items.selectedAttributes.metalColor', select: 'name' },
  { path: 'items.selectedAttributes.diamondType', select: 'name' },
  { path: 'items.selectedAttributes.diamondShape', select: 'name' },
  { path: 'items.selectedAttributes.diamondClarity', select: 'name' },
  { path: 'items.selectedAttributes.diamondColor', select: 'name' },
  { path: 'items.selectedAttributes.size', select: 'name' },
];

class CartService {
  // ------------------------------- find or create cart ----------------------------
  async findOrCreateCart(userId) {
    if (!userId) {
      return null;
    }

    let userCart = await Cart.findOne({ userId });

    if (userCart) {
      return userCart;
    }

    // Create brand new cart
    const newCart = new Cart({
      userId,
      items: [],
    });

    await newCart.save();
    return newCart;
  }

  // ------------------------------- format cart ----------------------------
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
    const totalItems = items.length;
    const subtotal = items.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
      0
    );
    const shipping = subtotal > 5000 || subtotal === 0 ? 0 : 250;
    const tax = Math.round(subtotal * 0.03); // 3% GST on fine jewellery in India
    const total = subtotal + shipping + tax;

    return {
      cartId: cart._id,
      userId: cart.userId,
      items: items.map((item) => {
        const prod = (item.productId && typeof item.productId === 'object' && item.productId._id)
          ? item.productId
          : null;
        const prodId = prod?._id || item.productId;
        const title = prod?.basicInfo?.title || '';
        const firstImg =
          prod?.colorImages?.[0]?.images?.[0] ||
          prod?.ornate?.ornateImages?.[0] ||
          prod?.images?.[0];
        const image = typeof firstImg === 'string' ? firstImg : firstImg?.url || '';
        const catFirst = prod?.categoryIds?.[0];
        let category = '';
        if (catFirst && typeof catFirst === 'object' && catFirst.name) {
          category = catFirst.name;
        }
        const originalPrice = prod?.pricing?.mrp || null;

        const sa = item.selectedAttributes;
        const getAttrVal = (val) => {
          if (!val) return '';
          if (typeof val === 'object' && val.name) return String(val.name).trim();
          if (typeof val === 'string' && !/^[0-9a-fA-F]{24}$/.test(val.trim())) return val.trim();
          return '';
        };

        const metalPurity = getAttrVal(sa?.metalPurity);
        const metalColor = getAttrVal(sa?.metalColor);
        const diamondType = getAttrVal(sa?.diamondType);
        const diamondShape = getAttrVal(sa?.diamondShape);
        const diamondClarity = getAttrVal(sa?.diamondClarity);
        const diamondColor = getAttrVal(sa?.diamondColor);
        const sizeVal = getAttrVal(sa?.size) || (typeof sa?.sizeRange === 'string' ? sa.sizeRange : '');
        const caratWeight = sa?.caratWeight != null ? Number(sa.caratWeight) : null;

        const selectedMetal = [metalPurity, metalColor].filter(Boolean).join(' ');

        const selectedAttributes = sa ? {
          metalPurity,
          metalColor,
          diamondType,
          diamondShape,
          diamondClarity,
          diamondColor,
          caratWeight,
          size: sizeVal,
          sizeRange: sa.sizeRange || null,
        } : undefined;

        return {
          _id: item._id || prodId,
          id: prodId,
          productId: prodId,
          title,
          slug: prod?.basicInfo?.slug || (title ? title.toLowerCase().trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') : ''),
          price: item.price,
          totalItemPrice: item.totalItemPrice || ((item.price || 0) * (item.quantity || 1)),
          originalPrice,
          image,
          category,
          quantity: item.quantity,
          selectedMetal,
          selectedSize: sizeVal || '',
          selectedAttributes,
          itemTotal: item.totalItemPrice || ((item.price || 0) * (item.quantity || 1)),
          addedAt: item.addedAt,
        };
      }),
      totalItems,
      subtotal,
      shipping,
      tax,
      total,
    };
  }

  // ------------------------------- get cart ----------------------------
  async getCart({ userId } = {}) {
    if (!userId) {
      return this.formatCart(null);
    }

    let cart = await Cart.findOne({ userId }).populate(cartPopulateOptions);

    if (!cart) {
      cart = await this.findOrCreateCart(userId);
    }

    return this.formatCart(cart);
  }

  // ------------------------------- add to cart ----------------------------
  async addToCart({ userId, productData, quantity = 1, options = {} } = {}) {
    const rawProductId = productData?.productId || options?.productId;
    if (!rawProductId) {
      throw new ApiError(400, 'Product ID is required');
    }

    if (!userId) {
      throw new ApiError(401, 'Please log in to add items to your cart');
    }

    const productId = rawProductId;
    const parsedQty = Math.max(1, parseInt(quantity, 10) || 1);
    const addedAt = productData.addedAt ? new Date(productData.addedAt) : new Date();

    const cart = await this.findOrCreateCart(userId);
    if (!cart) {
      throw new ApiError(500, 'Failed to initialize cart');
    }

    cart.userId = userId;

    let found = null;
    if (mongoose.Types.ObjectId.isValid(productId)) {
      found = await Product.findById(productId).lean();
      if (found) {
        if (!productData.price) productData.price = found.pricing?.salePrice || found.pricing?.mrp;
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
        caratWeight: selectedAttributes?.caratWeight != null ? Number(selectedAttributes.caratWeight) : (firstVariant?.caratWeight ?? firstCenterRow?.caratWeight ?? null),
        sizeRange: selectedAttributes?.sizeRange || (typeof selectedAttributes?.size === 'string' && !mongoose.isValidObjectId(selectedAttributes.size) ? selectedAttributes.size : null),
        size: toObjectId(selectedAttributes?.size),
      };
    }

    // Check if this product & variant combination exists in cart
    const existingIndex = cart.items.findIndex((item) => {
      const itemProdId = item.productId?._id || item.productId;
      const sameProduct = String(itemProdId) === String(productId);
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
      if (selectedAttributes) {
        cart.items[existingIndex].selectedAttributes = selectedAttributes;
      }
    } else {
      cart.items.push({
        productId,
        quantity: parsedQty,
        selectedAttributes: selectedAttributes ? {
          metalPurity: selectedAttributes.metalPurity || null,
          metalColor: selectedAttributes.metalColor || null,
          diamondType: selectedAttributes.diamondType || null,
          diamondShape: selectedAttributes.diamondShape || null,
          diamondClarity: selectedAttributes.diamondClarity || null,
          diamondColor: selectedAttributes.diamondColor || null,
          caratWeight: selectedAttributes.caratWeight != null ? Number(selectedAttributes.caratWeight) : null,
          sizeRange: selectedAttributes.sizeRange || null,
          size: selectedAttributes.size || null,
        } : undefined,
        price,
        totalItemPrice,
        addedAt,
      });
    }

    await cart.save();
    await cart.populate(cartPopulateOptions);
    return this.formatCart(cart);
  }

  // ------------------------------- update quantity ----------------------------
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
      (item) => String(item.productId?._id || item.productId || item._id) === productIdStr
    );

    if (index === -1) {
      throw new ApiError(404, 'Item not found in cart');
    }

    if (newQty <= 0) {
      cart.items.splice(index, 1);
    } else {
      cart.items[index].quantity = newQty;
      cart.items[index].totalItemPrice = (Number(cart.items[index].price) || 0) * newQty;
    }

    await cart.save();
    return { totalItems: cart.items.length };
  }

  // ------------------------------- remove item ----------------------------
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
      (item) => String(item.productId?._id || item.productId || item._id) !== productIdStr
    );

    await cart.save();
    await cart.populate(cartPopulateOptions);
    return this.formatCart(cart);
  }

  // ------------------------------- clear cart ----------------------------
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

  // ------------------------------- get counts ----------------------------
  async getCounts({ userId } = {}) {
    let cartCount = 0;
    let wishlistCount = 0;

    if (userId) {
      const cart = await Cart.findOne({
        userId,
      }).select('items.quantity').lean();

      if (cart?.items && Array.isArray(cart.items)) {
        cartCount = cart.items.length;
      }

      const wishlist = await Wishlist.findOne({ userId })
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
