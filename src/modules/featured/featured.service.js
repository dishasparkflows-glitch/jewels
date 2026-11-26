const mongoose = require('mongoose');
const { escapeRegex } = require('../../utils/string');
const Featured = require('./featured.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class FeaturedService {
  // ------------------------------- compute next display order ----------------------------
  async getNextDisplayOrder(type = 'Celebrate') {
    const cleanType = String(type || 'Celebrate').trim();
    const filter = {
      'meta.deletedAt': null,
      'display.type': new RegExp(`^${escapeRegex(cleanType)}$`, 'i'),
    };
    const [count, highestItem] = await Promise.all([
      Featured.countDocuments(filter),
      Featured.findOne(filter).sort({ 'display.order': -1 }).select('display.order').lean(),
    ]);
    const maxOrder = Number(highestItem?.display?.order) || 0;
    return Math.max(maxOrder, count) + 1;
  }

  // ------------------------------- create featured item ----------------------------
  async create(data) {
    if (data.name && data.name.trim()) {
      data.name = data.name.trim();
      const existing = await Featured.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        'meta.deletedAt': null,
      });
      if (existing) {
        throw new ApiError(409, `Featured item "${data.name}" already exists`);
      }
    }

    if (data.categoryId === '') {
      data.categoryId = null;
    }

    if (
      data.display &&
      (data.display.order === undefined || data.display.order === null || data.display.order === '')
    ) {
      data.display.order = await this.getNextDisplayOrder(data.display.type || 'Celebrate');
    }

    const item = await Featured.create(data);
    return item;
  }

  // ------------------------------- get one featured item ----------------------------
  async getOne(id) {
    let filter = { 'meta.deletedAt': null };
    if (mongoose.isValidObjectId(id)) {
      filter._id = id;
    } else {
      const clean = String(id).toLowerCase().trim();
      filter.$or = [
        { slug: clean },
        { name: new RegExp(`^${clean}$`, 'i') },
        { name: new RegExp(`^${clean.replace(/-/g, ' ')}$`, 'i') },
      ];
    }

    const item = await Featured.findOne(filter)
      .populate('categoryId', 'name type slug')
      .populate('menuItemIds', 'title')
      .populate('productIds', '_id basicInfo pricing images colorImages ornate productType isOrnate')
      .lean();
    if (!item) {
      throw new ApiError(404, 'Featured item not found');
    }
    const products = item.productIds || [];
    const pIds = products.map((p) => (p._id ? p._id.toString() : p.toString()));
    const populatedProducts = products.filter((p) => p && typeof p === 'object' && p._id);

    return {
      ...item,
      productCount: pIds.length,
      productIds: pIds,
      products: populatedProducts,
    };
  }

  // ------------------------------- get all featured items ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }
    if (queryParams.placement || queryParams.type) {
      const p = queryParams.type || queryParams.placement;
      filter['display.type'] = new RegExp(`^${p}$`, 'i');
    }
    if (queryParams.platform && queryParams.platform !== 'all') {
      filter['display.platform'] = queryParams.platform;
    }
    if (queryParams.search) {
      filter.name = new RegExp(escapeRegex(queryParams.search.trim()), 'i');
    }

    let query = Featured.find(filter)
      .populate('categoryId', 'name type slug')
      .populate('menuItemIds', 'title')
      .populate('productIds', '_id basicInfo pricing images colorImages ornate productType isOrnate')
      .sort({ 'display.order': 1, 'meta.createdAt': -1 })
      .skip(skip)
      .limit(limit);

    const [items, total] = await Promise.all([
      query.lean(),
      Featured.countDocuments(filter),
    ]);

    const formattedItems = items.map((item) => {
      const rawProducts = Array.isArray(item.productIds) ? item.productIds : [];
      const pIds = rawProducts.map((p) => (p && p._id ? p._id.toString() : String(p)));
      const populatedProducts = rawProducts.filter((p) => p && typeof p === 'object' && p._id);
      return {
        ...item,
        productCount: pIds.length,
        productIds: pIds,
        products: populatedProducts,
      };
    });

    return { items: formattedItems, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get featured item lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { 'meta.deletedAt': null };

    if (queryParams.status) {
      if (queryParams.status !== 'all') {
        filter.status = queryParams.status;
      }
    } else {
      filter.status = 'active';
    }

    if (queryParams.placement || queryParams.type) {
      const p = queryParams.type || queryParams.placement;
      filter['display.type'] = new RegExp(`^${p}$`, 'i');
    }

    if (queryParams.platform && queryParams.platform !== 'all') {
      filter['display.platform'] = queryParams.platform;
    }

    const isTheme = queryParams.theme === 'true' || queryParams.forTheme === 'true' || queryParams.minimal === 'true';

    let query = Featured.find(filter).sort({ 'display.order': 1, name: 1 });

    if (isTheme) {
      query = query.select('_id name display.type display.platform display.order image status categoryId');
    } else {
      query = query
        .select('_id name display image status categoryId productIds menuItemIds')
        .populate('categoryId', 'name type slug');
    }

    return await query.lean();
  }

  // ------------------------------- update featured item ----------------------------
  async update(id, data) {
    if (data.name && data.name.trim()) {
      data.name = data.name.trim();
      const existing = await Featured.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        _id: { $ne: id },
        'meta.deletedAt': null,
      });
      if (existing) {
        throw new ApiError(409, `Featured item "${data.name}" already exists`);
      }
    }

    if (data.categoryId === '') {
      data.categoryId = null;
    }

    const item = await Featured.findOneAndUpdate(
      { _id: id, 'meta.deletedAt': null },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    )
      .populate('categoryId', 'name type slug')
      .populate('menuItemIds', 'title')
      .populate('productIds', '_id basicInfo pricing images colorImages ornate productType isOrnate')
      .lean();

    if (!item) {
      throw new ApiError(404, 'Featured item not found');
    }

    const rawProducts = Array.isArray(item.productIds) ? item.productIds : [];
    const pIds = rawProducts.map((p) => (p && p._id ? p._id.toString() : String(p)));
    const populatedProducts = rawProducts.filter((p) => p && typeof p === 'object' && p._id);

    return {
      ...item,
      productCount: pIds.length,
      products: populatedProducts,
      productIds: pIds,
    };
  }

  // ------------------------------- reorder featured items ----------------------------
  async reorder(items) {
    if (Array.isArray(items)) {
      const bulkOps = items.map((it, idx) => {
        const ord = typeof it.display?.order === 'number' ? it.display.order : (typeof it.order === 'number' ? it.order : idx);
        return {
          updateOne: {
            filter: { _id: it.id || it._id, 'meta.deletedAt': null },
            update: { $set: { 'display.order': ord } },
          },
        };
      });
      if (bulkOps.length > 0) {
        await Featured.bulkWrite(bulkOps);
      }
    }
    return { success: true };
  }

  // ------------------------------- delete featured item ----------------------------
  async delete(id) {
    const item = await Featured.findOneAndUpdate(
      { _id: id, 'meta.deletedAt': null },
      { $set: { status: 'inactive', 'meta.deletedAt': new Date() } },
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'Featured item not found');
    }

    return { message: 'Featured item deleted successfully', id };
  }

  // ------------------------------- bulk delete featured items ----------------------------
  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, 'Please provide an array of featured IDs to delete');
    }

    const result = await Featured.updateMany(
      { _id: { $in: ids } },
      { $set: { status: 'inactive', 'meta.deletedAt': new Date() } }
    );

    return {
      message: `${result.modifiedCount} featured item(s) deleted successfully`,
      deletedCount: result.modifiedCount,
      ids,
    };
  }
}

module.exports = new FeaturedService();
