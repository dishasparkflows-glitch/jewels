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

const toObjectId = (val) => (val && mongoose.isValidObjectId(val) ? new mongoose.Types.ObjectId(val) : null);

const getAttrString = (val) => {
  if (!val) return '';
  if (typeof val === 'object' && val.name) return String(val.name).trim();
  if (typeof val === 'string' && !/^[0-9a-fA-F]{24}$/.test(val.trim())) return val.trim();
  return '';
};

class CartService {
  // ------------------------------- find or create cart ----------------------------
  async findOrCreateCart(userId) {
    if (!userId) return null;
    let userCart = await Cart.findOne({ userId });
    if (!userCart) {
      userCart = await Cart.create({ userId, items: [] });
    }
    return userCart;
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
        const prod = item.productId && typeof item.productId === 'object' ? item.productId : null;
        const prodId = prod?._id || item.productId;
        const title = prod?.basicInfo?.title || '';
        const firstImg =
          prod?.colorImages?.[0]?.images?.[0] ||
          prod?.ornate?.ornateImages?.[0] ||
          prod?.images?.[0];
        const image = typeof firstImg === 'string' ? firstImg : firstImg?.url || '';
        const category = prod?.categoryIds?.[0]?.name || '';
        const originalPrice = prod?.pricing?.mrp || null;

        const sa = item.selectedAttributes;
        const metalPurity = getAttrString(sa?.metalPurity);
        const metalColor = getAttrString(sa?.metalColor);
        const diamondType = getAttrString(sa?.diamondType);
        const diamondShape = getAttrString(sa?.diamondShape);
        const diamondClarity = getAttrString(sa?.diamondClarity);
        const diamondColor = getAttrString(sa?.diamondColor);
        const sizeVal = getAttrString(sa?.size) || (typeof sa?.sizeRange === 'string' ? sa.sizeRange : '');
        const caratWeight = sa?.caratWeight != null ? Number(sa.caratWeight) : null;

        const selectedMetal = [metalPurity, metalColor].filter(Boolean).join(' ');
        const itemTotal = Number(item.totalItemPrice) || ((Number(item.price) || 0) * (Number(item.quantity) || 1));

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
          totalItemPrice: itemTotal,
          originalPrice,
          image,
          category,
          quantity: item.quantity,
          selectedMetal,
          selectedSize: sizeVal || '',
          selectedAttributes,
          itemTotal,
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

  // ------------------------------- consolidate cart items ----------------------------
  consolidateCartItems(cart) {
    if (!cart?.items?.length) return false;
    const map = new Map();
    let hasDuplicates = false;

    for (const item of cart.items) {
      const prodId = String(item.productId?._id || item.productId || '');
      if (!prodId) continue;

      if (map.has(prodId)) {
        hasDuplicates = true;
        const existing = map.get(prodId);
        existing.quantity += (Number(item.quantity) || 1);
        existing.price = item.price || existing.price;
        existing.totalItemPrice = (Number(existing.price) || 0) * existing.quantity;
        if (item.selectedAttributes) existing.selectedAttributes = item.selectedAttributes;
      } else {
        map.set(prodId, item);
      }
    }

    if (hasDuplicates) {
      cart.items = Array.from(map.values());
      return true;
    }
    return false;
  }

  // ------------------------------- get cart ----------------------------
  async getCart({ userId } = {}) {
    if (!userId) return this.formatCart(null);

    let cart = await Cart.findOne({ userId }).populate(cartPopulateOptions);

    if (!cart) {
      cart = await this.findOrCreateCart(userId);
    } else if (this.consolidateCartItems(cart)) {
      await cart.save();
      await cart.populate(cartPopulateOptions);
    }

    return this.formatCart(cart);
  }

  // ------------------------------- add to cart ----------------------------
  async addToCart({
    userId,
    productId,
    quantity = 1,
    price,
    totalItemPrice,
    selectedAttributes,
    options = {},
  } = {}) {
    const rawProductId = productId || options?.productId;
    if (!rawProductId) {
      throw new ApiError(400, 'Product ID is required');
    }
    if (!userId) {
      throw new ApiError(401, 'Please log in to add items to your cart');
    }

    const parsedQty = Math.max(1, parseInt(quantity, 10) || 1);
    const cart = await this.findOrCreateCart(userId);
    if (!cart) {
      throw new ApiError(500, 'Failed to initialize cart');
    }

    cart.userId = userId;

    let found = null;
    if (mongoose.Types.ObjectId.isValid(rawProductId)) {
      found = await Product.findById(rawProductId).lean();
    }

    // Resolve price & item total using nullish coalescing
    const resolvedPrice = Number(
      price ?? options?.price ?? found?.pricing?.salePrice ?? found?.pricing?.mrp ?? 0
    );
    const resolvedTotal = Number(
      totalItemPrice ?? options?.totalItemPrice ?? (resolvedPrice * parsedQty)
    );

    // Resolve & normalize selected attributes
    const rawAttributes = selectedAttributes || options?.selectedAttributes || null;
    let resolvedAttributes = null;

    if (rawAttributes && typeof rawAttributes === 'object') {
      const hasValues = Object.values(rawAttributes).some((v) => v !== null && v !== undefined && v !== '');
      if (hasValues) {
        resolvedAttributes = rawAttributes;
      }
    }

    const isGold = found?.productType === 'gold';
    if (isGold || resolvedAttributes) {
      const firstVariant = found?.variants?.[0] || null;
      const firstCenterRow = found?.centerDiamondRows?.[0] || null;

      resolvedAttributes = {
        metalPurity: toObjectId(resolvedAttributes?.metalPurityId || resolvedAttributes?.metalPurity || firstVariant?.metalPurityId || found?.metalPurityIds?.[0]),
        metalColor: toObjectId(resolvedAttributes?.metalColorId || resolvedAttributes?.metalColor || firstVariant?.metalColorId || found?.metalColorIds?.[0]),
        diamondType: toObjectId(resolvedAttributes?.diamondTypeId || resolvedAttributes?.diamondType || firstVariant?.diamondTypeId || firstCenterRow?.diamondTypeId),
        diamondShape: toObjectId(resolvedAttributes?.diamondShapeId || resolvedAttributes?.diamondShape || firstVariant?.diamondShapeId || firstCenterRow?.diamondShapeId),
        diamondClarity: toObjectId(resolvedAttributes?.diamondClarityId || resolvedAttributes?.diamondClarity || firstVariant?.diamondClarityId || firstCenterRow?.diamondClarityId),
        diamondColor: toObjectId(resolvedAttributes?.diamondColorId || resolvedAttributes?.diamondColor || firstVariant?.diamondColorId || firstCenterRow?.diamondColorId),
        caratWeight: resolvedAttributes?.caratWeight != null ? Number(resolvedAttributes.caratWeight) : (firstVariant?.caratWeight ?? firstCenterRow?.caratWeight ?? null),
        sizeRange: resolvedAttributes?.sizeRange || (typeof resolvedAttributes?.size === 'string' && !mongoose.isValidObjectId(resolvedAttributes.size) ? resolvedAttributes.size : null),
        size: toObjectId(resolvedAttributes?.sizeId || resolvedAttributes?.size),
      };
    }

    // Merge if same product already exists in cart, else push new item
    const existingIndex = cart.items.findIndex((item) => {
      const itemProdId = item.productId?._id || item.productId;
      return String(itemProdId) === String(rawProductId);
    });

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += parsedQty;
      cart.items[existingIndex].price = resolvedPrice;
      cart.items[existingIndex].totalItemPrice =
        (Number(resolvedPrice) || Number(cart.items[existingIndex].price) || 0) * cart.items[existingIndex].quantity;
      if (resolvedAttributes) {
        cart.items[existingIndex].selectedAttributes = resolvedAttributes;
      }
    } else {
      cart.items.push({
        productId: rawProductId,
        quantity: parsedQty,
        selectedAttributes: resolvedAttributes || undefined,
        price: resolvedPrice,
        totalItemPrice: resolvedTotal,
        addedAt: new Date(),
      });
    }

    await cart.save();
    await cart.populate(cartPopulateOptions);
    return this.formatCart(cart);
  }

  // ------------------------------- update quantity ----------------------------
  async updateQuantity({ userId, productId, quantity } = {}) {
    if (!productId) throw new ApiError(400, 'Product ID is required');
    if (!userId) throw new ApiError(401, 'Please log in to update cart items');

    const productIdStr = String(productId).trim();
    const newQty = parseInt(quantity, 10);
    const cart = await this.findOrCreateCart(userId);
    if (!cart) throw new ApiError(404, 'Cart not found');

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
    if (!productId) throw new ApiError(400, 'Product ID is required');
    if (!userId) throw new ApiError(401, 'Please log in to remove cart items');

    const productIdStr = String(productId).trim();
    const cart = await this.findOrCreateCart(userId);
    if (!cart) return this.formatCart(null);

    cart.items = cart.items.filter(
      (item) => String(item.productId?._id || item.productId || item._id) !== productIdStr
    );

    await cart.save();
    await cart.populate(cartPopulateOptions);
    return this.formatCart(cart);
  }

  // ------------------------------- clear cart ----------------------------
  async clearCart({ userId } = {}) {
    if (!userId) return this.formatCart(null);
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
      const [cart, wishlist] = await Promise.all([
        Cart.findOne({ userId }).select('items.quantity').lean(),
        Wishlist.findOne({ userId }).select('productIds').lean(),
      ]);

      cartCount = cart?.items?.length || 0;
      wishlistCount = wishlist?.productIds?.length || 0;
    }

    return {
      cartCount,
      wishlistCount,
      totalItems: cartCount,
    };
  }
}

module.exports = new CartService();
