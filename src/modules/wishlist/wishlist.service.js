const mongoose = require('mongoose');
const Wishlist = require('./wishlist.model');
const ApiError = require('../../utils/ApiError');
const { formatStorefrontProduct } = require('../product/product.utils');

const WISHLIST_POPULATE_CONFIG = {
  path: 'items.refId',
  select: '_id basicInfo pricing colorImages metalColorIds productType isOrnate variants centerDiamondRows stockStatus categoryIds ornate.ornateImages title sku price carat image shapeId colorId clarityId typeId',
  strictPopulate: false,
  populate: [
    { path: 'metalColorIds', select: 'name colorCode colorCodeEnd code hex', strictPopulate: false },
    { path: 'colorImages.metalColorId', select: 'name colorCode colorCodeEnd code hex', strictPopulate: false },
    { path: 'colorId', select: 'name', strictPopulate: false },
    { path: 'clarityId', select: 'name', strictPopulate: false },
    { path: 'shapeId', select: 'name', strictPopulate: false },
    { path: 'typeId', select: 'name', strictPopulate: false },
  ],
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
    refId: formatted._id,
    itemType: 'product',
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

function formatWishlistDiamond(d) {
  if (!d) return null;
  return {
    _id: d._id,
    refId: d._id,
    itemType: 'diamond',
    productType: 'diamond',
    basicInfo: {
      title: d.title || '',
      slug: d.sku || String(d._id),
    },
    pricing: {
      salePrice: Number(d.price) || 0,
      mrp: Number(d.price) || 0,
    },
    image: d.image?.url || '',
    metalColors: [],
    carat: d.carat,
    shape: d.shapeId?.name || '',
    color: d.colorId?.name || '',
    clarity: d.clarityId?.name || '',
    diamondType: d.typeId?.name || '',
    stockStatus: 'in_stock',
  };
}

const normalizeItemType = (itemType) =>
  String(itemType || 'product').toLowerCase() === 'diamond' ? 'diamond' : 'product';

class WishlistService {
  // ------------------------------- format wishlist ----------------------------
  formatWishlist(wishlistDoc) {
    if (!wishlistDoc) return null;
    const w = typeof wishlistDoc.toObject === 'function' ? wishlistDoc.toObject() : wishlistDoc;
    const rawItems = Array.isArray(w.items) ? w.items : [];
    const formattedItems = rawItems
      .map((entry) => {
        const doc = entry?.refId && typeof entry.refId === 'object' ? entry.refId : null;
        if (!doc) return null;
        return entry.itemType === 'diamond'
          ? formatWishlistDiamond(doc)
          : formatWishlistProduct(doc);
      })
      .filter(Boolean);

    return {
      _id: w._id,
      userId: w.userId,
      items: formattedItems,
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
        items: [],
        addedAt: new Date(),
      });
    }

    return wishlist;
  }

  // ------------------------------- get count ----------------------------
  async getCount(userId) {
    if (!userId) return { count: 0, wishlistCount: 0 };
    const wishlist = await Wishlist.findOne({ userId }).select('items').lean();
    const count = wishlist?.items?.length || 0;
    return { count, wishlistCount: count };
  }

  // ------------------------------- get wishlist ----------------------------
  async getWishlist(userId) {
    if (!userId) {
      return null;
    }

    let wishlist = await Wishlist.findOne({ userId }).populate(WISHLIST_POPULATE_CONFIG);
    if (!wishlist) {
      wishlist = await this.findOrCreateWishlist(userId);
    }

    return this.formatWishlist(wishlist);
  }

  // ------------------------------- toggle item in wishlist ----------------------------
  async toggleItem({ userId, refId, itemType = 'product' }) {
    const refIdStr = String(refId || '').trim();
    if (!refIdStr || !mongoose.Types.ObjectId.isValid(refIdStr)) {
      throw new ApiError(400, 'A valid reference ID is required');
    }

    const resolvedType = normalizeItemType(itemType);
    const wishlist = await this.findOrCreateWishlist(userId);

    const existingIndex = wishlist.items.findIndex(
      (entry) => String(entry.refId) === refIdStr
    );

    let isWishlisted = false;
    if (existingIndex > -1) {
      wishlist.items.splice(existingIndex, 1);
      isWishlisted = false;
    } else {
      wishlist.items.push({
        itemType: resolvedType,
        refId: new mongoose.Types.ObjectId(refIdStr),
        addedAt: new Date(),
      });
      wishlist.addedAt = new Date();
      isWishlisted = true;
    }

    await wishlist.save();

    return {
      isWishlisted,
      wishlistCount: wishlist.items.length,
      refId: refIdStr,
      itemType: resolvedType,
    };
  }

  // ------------------------------- merge guest wishlist ----------------------------
  async mergeWishlist({ userId, items = [] } = {}) {
    const wishlist = await this.findOrCreateWishlist(userId);
    if (!Array.isArray(items) || items.length === 0) {
      return this.getWishlist(userId);
    }

    const existingIds = new Set(wishlist.items.map((entry) => String(entry.refId)));
    let addedAny = false;

    for (const entry of items) {
      const rawRefId =
        typeof entry === 'string'
          ? entry
          : entry?.refId?._id || entry?.refId || entry?._id || entry?.id;
      const refIdStr = String(rawRefId || '').trim();
      if (!refIdStr || !mongoose.Types.ObjectId.isValid(refIdStr) || existingIds.has(refIdStr)) {
        continue;
      }

      const resolvedType = normalizeItemType(
        entry?.itemType || (entry?.productType === 'diamond' ? 'diamond' : 'product')
      );
      wishlist.items.push({
        itemType: resolvedType,
        refId: new mongoose.Types.ObjectId(refIdStr),
        addedAt: new Date(),
      });
      existingIds.add(refIdStr);
      addedAny = true;
    }

    if (addedAny) {
      wishlist.addedAt = new Date();
      await wishlist.save();
    }

    return this.getWishlist(userId);
  }

  // ------------------------------- add item to wishlist ----------------------------
  async addItem({ userId, refId, itemType = 'product' }) {
    const refIdStr = String(refId || '').trim();
    if (!refIdStr || !mongoose.Types.ObjectId.isValid(refIdStr)) {
      throw new ApiError(400, 'A valid reference ID is required');
    }

    const resolvedType = normalizeItemType(itemType);
    const wishlist = await this.findOrCreateWishlist(userId);

    const exists = wishlist.items.some((entry) => String(entry.refId) === refIdStr);
    if (!exists) {
      wishlist.items.push({
        itemType: resolvedType,
        refId: new mongoose.Types.ObjectId(refIdStr),
        addedAt: new Date(),
      });
      wishlist.addedAt = new Date();
      await wishlist.save();
    }

    return this.getWishlist(userId);
  }

  // ------------------------------- remove item from wishlist ----------------------------
  async removeItem({ userId, refId }) {
    const refIdStr = String(refId || '').trim();
    if (!refIdStr || !mongoose.Types.ObjectId.isValid(refIdStr)) {
      throw new ApiError(400, 'A valid reference ID is required');
    }

    const wishlist = await this.findOrCreateWishlist(userId);

    const initialLength = wishlist.items.length;
    wishlist.items = wishlist.items.filter(
      (entry) => String(entry.refId) !== refIdStr
    );

    if (wishlist.items.length !== initialLength) {
      await wishlist.save();
    }

    return this.getWishlist(userId);
  }

  // ------------------------------- clear wishlist ----------------------------
  async clearWishlist(userId) {
    const wishlist = await this.findOrCreateWishlist(userId);
    wishlist.items = [];
    await wishlist.save();
    return this.formatWishlist(wishlist);
  }
}

module.exports = new WishlistService();
