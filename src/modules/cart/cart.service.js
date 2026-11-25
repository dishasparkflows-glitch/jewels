const mongoose = require('mongoose');
const Cart = require('./cart.model');
const Product = require('../product/product.model');
const Diamond = require('../diamond/diamond.model');
const Wishlist = require('../wishlist/wishlist.model');
const Order = require('../order/order.model');
const Return = require('../return/return.model');
const ApiError = require('../../utils/ApiError');

const cartPopulateOptions = [
  {
    path: 'items.refId',
    select: 'basicInfo pricing colorImages ornate images categoryIds productType variants centerDiamondRows sku title description price rate carat image status colorId clarityId shapeId typeId',
    strictPopulate: false,
    populate: [
      { path: 'categoryIds', select: 'name', strictPopulate: false },
      { path: 'colorId', select: 'name', strictPopulate: false },
      { path: 'clarityId', select: 'name', strictPopulate: false },
      { path: 'shapeId', select: 'name', strictPopulate: false },
      { path: 'typeId', select: 'name', strictPopulate: false },
    ],
  },
  { path: 'items.selectedAttributes.metalPurity', select: 'name', strictPopulate: false },
  { path: 'items.selectedAttributes.metalColor', select: 'name', strictPopulate: false },
  { path: 'items.selectedAttributes.diamondType', select: 'name', strictPopulate: false },
  { path: 'items.selectedAttributes.diamondShape', select: 'name', strictPopulate: false },
  { path: 'items.selectedAttributes.diamondClarity', select: 'name', strictPopulate: false },
  { path: 'items.selectedAttributes.diamondColor', select: 'name', strictPopulate: false },
  { path: 'items.selectedAttributes.size', select: 'name', strictPopulate: false },
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
        const doc = item.refId && typeof item.refId === 'object' ? item.refId : null;
        const itemType = item.itemType || 'product';
        const isDiamond = itemType === 'diamond';
        const refId = doc?._id || item.refId;
        const title = isDiamond ? (doc?.title || '') : (doc?.basicInfo?.title || doc?.title || '');
        const sku = isDiamond ? (doc?.sku || '') : (doc?.basicInfo?.sku || doc?.sku || '');
        const firstImg = isDiamond
          ? (doc?.image?.url || doc?.image || '')
          : (doc?.colorImages?.[0]?.images?.[0] ||
            doc?.ornate?.ornateImages?.[0] ||
            doc?.images?.[0]);
        const image = typeof firstImg === 'string' ? firstImg : firstImg?.url || '';
        const category = isDiamond ? 'Diamond' : (doc?.categoryIds?.[0]?.name || '');
        const originalPrice = isDiamond ? null : (doc?.pricing?.mrp || null);

        const sa = item.selectedAttributes;
        const metalPurity = getAttrString(sa?.metalPurity);
        const metalColor = getAttrString(sa?.metalColor);
        const diamondType = getAttrString(sa?.diamondType) || (isDiamond ? (doc?.typeId?.name || '') : '');
        const diamondShape = getAttrString(sa?.diamondShape) || (isDiamond ? (doc?.shapeId?.name || '') : '');
        const diamondClarity = getAttrString(sa?.diamondClarity) || (isDiamond ? (doc?.clarityId?.name || '') : '');
        const diamondColor = getAttrString(sa?.diamondColor) || (isDiamond ? (doc?.colorId?.name || '') : '');
        const sizeVal = getAttrString(sa?.size) || (typeof sa?.sizeRange === 'string' ? sa.sizeRange : '');
        const caratWeight = sa?.caratWeight != null
          ? Number(sa.caratWeight)
          : (isDiamond && doc?.carat != null ? Number(doc.carat) : null);

        const pPurity = (metalPurity || '').replace(/\s*gold$/i, '').trim();
        const selectedMetal = item.selectedMetal || (pPurity && metalColor ? `${pPurity} ${metalColor}` : [metalPurity, metalColor].filter(Boolean).join(' '));
        const itemTotal = Number(item.totalItemPrice) || ((Number(item.price) || 0) * (Number(item.quantity) || 1));

        const selectedAttributes = (sa || isDiamond) ? {
          metalPurity,
          metalColor,
          diamondType,
          diamondShape,
          diamondClarity,
          diamondColor,
          caratWeight,
          size: sizeVal,
          sizeRange: sa?.sizeRange || null,
        } : undefined;

        const slug = isDiamond
          ? (doc?.sku || String(refId || ''))
          : (doc?.basicInfo?.slug || (title ? title.toLowerCase().trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') : ''));

        return {
          _id: item._id || refId,
          id: refId,
          refId,
          itemType,
          ...(isDiamond ? { isDiamond: true, productType: 'diamond' } : {}),
          title,
          sku,
          slug,
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
      const refKey = String(item.refId?._id || item.refId || '');
      if (!refKey) continue;

      if (map.has(refKey)) {
        hasDuplicates = true;
        const existing = map.get(refKey);
        existing.quantity += (Number(item.quantity) || 1);
        existing.price = item.price || existing.price;
        existing.totalItemPrice = (Number(existing.price) || 0) * existing.quantity;
        if (item.selectedAttributes) existing.selectedAttributes = item.selectedAttributes;
      } else {
        map.set(refKey, item);
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
    refId,
    itemType = 'product',
    quantity = 1,
    price,
    totalItemPrice,
    selectedMetal,
    selectedSize,
    selectedAttributes,
  } = {}) {
    const rawRefId = String(refId || '').trim();
    if (!rawRefId || !mongoose.Types.ObjectId.isValid(rawRefId)) {
      throw new ApiError(400, 'A valid reference ID is required');
    }
    if (!userId) {
      throw new ApiError(401, 'Please log in to add items to your cart');
    }

    const parsedQty = Math.max(1, parseInt(quantity, 10) || 1);
    const resolvedItemType = String(itemType || 'product').toLowerCase() === 'diamond' ? 'diamond' : 'product';
    const isDiamondItem = resolvedItemType === 'diamond';

    const cart = await this.findOrCreateCart(userId);
    if (!cart) {
      throw new ApiError(500, 'Failed to initialize cart');
    }

    cart.userId = userId;

    let found = null;
    let foundDiamond = null;

    if (isDiamondItem) {
      foundDiamond = await Diamond.findById(rawRefId)
        .populate('colorId clarityId shapeId typeId')
        .lean();
      if (!foundDiamond) {
        throw new ApiError(404, 'Diamond not found');
      }
    } else {
      found = await Product.findById(rawRefId).lean();
      if (!found) {
        throw new ApiError(404, 'Product not found');
      }
    }

    // Resolve price & item total
    const resolvedPrice = Number(
      price ?? (isDiamondItem ? foundDiamond?.price : (found?.pricing?.salePrice ?? found?.pricing?.mrp)) ?? 0
    );
    const resolvedTotal = Number(totalItemPrice ?? resolvedPrice * parsedQty);

    // Resolve & normalize selected attributes
    let resolvedAttributes = null;
    if (selectedAttributes && typeof selectedAttributes === 'object') {
      const hasValues = Object.values(selectedAttributes).some(
        (v) => v !== null && v !== undefined && v !== ''
      );
      if (hasValues) {
        resolvedAttributes = { ...selectedAttributes };
      }
    }

    const isGold = found?.productType === 'gold';
    if (isDiamondItem) {
      resolvedAttributes = {
        ...(resolvedAttributes || {}),
        diamondType: resolvedAttributes?.diamondType || foundDiamond?.typeId?.name || '',
        diamondShape: resolvedAttributes?.diamondShape || foundDiamond?.shapeId?.name || '',
        diamondClarity: resolvedAttributes?.diamondClarity || foundDiamond?.clarityId?.name || '',
        diamondColor: resolvedAttributes?.diamondColor || foundDiamond?.colorId?.name || '',
        caratWeight: resolvedAttributes?.caratWeight != null ? Number(resolvedAttributes.caratWeight) : (foundDiamond?.carat ?? null),
      };
    } else if (isGold || resolvedAttributes) {
      const firstVariant = found?.variants?.[0] || null;
      const firstCenterRow = found?.centerDiamondRows?.[0] || null;

      const resolveAttrVal = (val, idVal, fallbackId) => {
        if (typeof val === 'string' && val.trim() && !mongoose.isValidObjectId(val.trim())) {
          return val.trim();
        }
        if (typeof val === 'object' && val?.name && typeof val.name === 'string') {
          return val.name.trim();
        }
        const effectiveId = idVal || (val && mongoose.isValidObjectId(val) ? val : null) || fallbackId;
        return toObjectId(effectiveId);
      };

      resolvedAttributes = {
        metalPurity: resolveAttrVal(resolvedAttributes?.metalPurity, resolvedAttributes?.metalPurityId, firstVariant?.metalPurityId || found?.metalPurityIds?.[0]),
        metalColor: resolveAttrVal(resolvedAttributes?.metalColor, resolvedAttributes?.metalColorId, firstVariant?.metalColorId || found?.metalColorIds?.[0]),
        diamondType: resolveAttrVal(resolvedAttributes?.diamondType, resolvedAttributes?.diamondTypeId, firstVariant?.diamondTypeId || firstCenterRow?.diamondTypeId),
        diamondShape: resolveAttrVal(resolvedAttributes?.diamondShape, resolvedAttributes?.diamondShapeId, firstVariant?.diamondShapeId || firstCenterRow?.diamondShapeId),
        diamondClarity: resolveAttrVal(resolvedAttributes?.diamondClarity, resolvedAttributes?.diamondClarityId, firstVariant?.diamondClarityId || firstCenterRow?.diamondClarityId),
        diamondColor: resolveAttrVal(resolvedAttributes?.diamondColor, resolvedAttributes?.diamondColorId, firstVariant?.diamondColorId || firstCenterRow?.diamondColorId),
        caratWeight: resolvedAttributes?.caratWeight != null ? Number(resolvedAttributes.caratWeight) : (firstVariant?.caratWeight ?? firstCenterRow?.caratWeight ?? null),
        sizeRange: resolvedAttributes?.sizeRange || (typeof resolvedAttributes?.size === 'string' && !mongoose.isValidObjectId(resolvedAttributes.size) ? resolvedAttributes.size : null),
        size: resolveAttrVal(resolvedAttributes?.size, resolvedAttributes?.sizeId, null),
      };
    }

    const resolvedSelectedMetal = selectedMetal || (
      resolvedAttributes?.metalColor && resolvedAttributes?.metalPurity
        ? `${resolvedAttributes.metalPurity} ${resolvedAttributes.metalColor}`
        : (resolvedAttributes?.metalColor || resolvedAttributes?.metalPurity || '')
    );
    const resolvedSelectedSize = selectedSize || (
      typeof resolvedAttributes?.size === 'string' ? resolvedAttributes.size : (resolvedAttributes?.sizeRange || '')
    );

    // Merge if same item already exists in cart, else push new item
    const existingIndex = cart.items.findIndex((item) => {
      const itemRefId = item.refId?._id || item.refId;
      return String(itemRefId) === rawRefId;
    });

    if (existingIndex > -1) {
      cart.items[existingIndex].itemType = resolvedItemType;
      cart.items[existingIndex].refId = rawRefId;
      cart.items[existingIndex].quantity += parsedQty;
      cart.items[existingIndex].price = resolvedPrice;
      cart.items[existingIndex].totalItemPrice =
        (Number(resolvedPrice) || Number(cart.items[existingIndex].price) || 0) * cart.items[existingIndex].quantity;
      if (resolvedAttributes) {
        cart.items[existingIndex].selectedAttributes = resolvedAttributes;
      }
      if (resolvedSelectedMetal) {
        cart.items[existingIndex].selectedMetal = resolvedSelectedMetal;
      }
      if (resolvedSelectedSize) {
        cart.items[existingIndex].selectedSize = resolvedSelectedSize;
      }
    } else {
      cart.items.push({
        itemType: resolvedItemType,
        refId: rawRefId,
        quantity: parsedQty,
        selectedMetal: resolvedSelectedMetal,
        selectedSize: resolvedSelectedSize,
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
  async updateQuantity({ userId, refId, quantity } = {}) {
    const refIdStr = String(refId || '').trim();
    if (!refIdStr || !mongoose.Types.ObjectId.isValid(refIdStr)) {
      throw new ApiError(400, 'A valid reference ID is required');
    }
    if (!userId) throw new ApiError(401, 'Please log in to update cart items');

    const newQty = parseInt(quantity, 10);
    const cart = await this.findOrCreateCart(userId);
    if (!cart) throw new ApiError(404, 'Cart not found');

    const index = cart.items.findIndex(
      (item) => String(item.refId?._id || item.refId) === refIdStr
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
  async removeItem({ userId, refId } = {}) {
    const refIdStr = String(refId || '').trim();
    if (!refIdStr || !mongoose.Types.ObjectId.isValid(refIdStr)) {
      throw new ApiError(400, 'A valid reference ID is required');
    }
    if (!userId) throw new ApiError(401, 'Please log in to remove cart items');

    const cart = await this.findOrCreateCart(userId);
    if (!cart) return this.formatCart(null);

    cart.items = cart.items.filter(
      (item) => String(item.refId?._id || item.refId) !== refIdStr
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
  async getCounts({ userId, userEmail } = {}) {
    let cartCount = 0;
    let wishlistCount = 0;
    let orderCount = 0;
    let returnOrderCount = 0;

    if (userId) {
      const uId = mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;
      const orderFilter = { 'meta.deletedAt': null };
      if (userEmail) {
        const escapedEmail = String(userEmail).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const emailRegex = new RegExp(`^${escapedEmail}$`, 'i');
        orderFilter.$or = [
          { userId: uId },
          { 'customer.email': emailRegex },
          { 'shippingAddress.email': emailRegex },
        ];
      } else {
        orderFilter.userId = uId;
      }

      const returnFilter = {
        $or: [{ userId: uId }],
      };
      if (userEmail) {
        const escapedEmail = String(userEmail).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const emailRegex = new RegExp(`^${escapedEmail}$`, 'i');
        returnFilter.$or.push({ 'customer.email': emailRegex });
      }

      const [cart, wishlist, ordersCount, returnsCount] = await Promise.all([
        Cart.findOne({ userId: uId }).select('items.quantity').lean(),
        Wishlist.findOne({ userId: uId }).select('items').lean(),
        Order.countDocuments(orderFilter),
        Return.countDocuments(returnFilter),
      ]);

      cartCount = cart?.items?.length || 0;
      wishlistCount = wishlist?.items?.length || 0;
      orderCount = ordersCount || 0;
      returnOrderCount = returnsCount || 0;
    }

    return {
      cartCount,
      wishlistCount,
      orderCount,
      returnOrderCount,
      totalItems: cartCount,
    };
  }
}

module.exports = new CartService();
