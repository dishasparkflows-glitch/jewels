const Featured = require('./featured.model');
const Product = require('../product/product.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class FeaturedService {
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
    } else {
      data.name = '';
    }

    const productIds = data.productIds || data.products || [];
    if (Array.isArray(productIds)) {
      data.productIds = productIds;
      data.productCount = productIds.length;
    }

    if (data.categoryId === '' || data.categoryId === undefined) {
      data.categoryId = null;
    }

    const item = await Featured.create(data);
    return item;
  }

  // ------------------------------- get one featured item ----------------------------
  async getOne(id) {
    const item = await Featured.findOne({ _id: id, 'meta.deletedAt': null })
      .populate('categoryId', 'name type slug')
      .populate('menuItemIds', 'title')
      .populate('productIds', '_id basicInfo pricing images colorImages')
      .lean();
    if (!item) {
      throw new ApiError(404, 'Featured item not found');
    }
    const products = item.productIds || [];
    const pIds = products.map((p) => (p._id ? p._id.toString() : p.toString()));

    return {
      ...item,
      productCount: item.productCount || pIds.length,
      products,
      productIds: pIds,
    };
  }

  // ------------------------------- get all featured items ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }
    if (queryParams.placement) {
      filter.placement = new RegExp(`^${queryParams.placement}$`, 'i');
    }
    if (queryParams.search) {
      filter.name = new RegExp(queryParams.search, 'i');
    }

    const populateProducts = queryParams.populateProducts === 'true';

    let query = Featured.find(filter)
      .populate('categoryId', 'name type slug')
      .populate('menuItemIds', 'title')
      .sort({ order: 1, 'meta.createdAt': -1 })
      .skip(skip)
      .limit(limit);

    if (populateProducts) {
      query = query.populate('productIds', '_id basicInfo pricing images colorImages');
    }

    const [items, total] = await Promise.all([
      query.lean(),
      Featured.countDocuments(filter),
    ]);

    const formattedItems = items.map((item) => {
      const pIds = Array.isArray(item.productIds)
        ? item.productIds.map((p) => (p._id ? p._id.toString() : p.toString()))
        : [];
      return {
        ...item,
        productCount: item.productCount !== undefined && item.productCount !== 0 ? item.productCount : pIds.length,
        productIds: pIds,
      };
    });

    return { items: formattedItems, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get featured item lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { 'meta.deletedAt': null };

    if (queryParams.status) {
      filter.status = queryParams.status;
    } else {
      filter.status = 'active';
    }

    if (queryParams.placement) {
      filter.placement = new RegExp(`^${queryParams.placement}$`, 'i');
    }

    return await Featured.find(filter)
      .sort({ order: 1, name: 1 })
      .select('_id name placement image order status categoryId')
      .lean();
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

    const productIds = data.productIds !== undefined ? data.productIds : data.products;
    if (Array.isArray(productIds)) {
      data.productIds = productIds;
      data.productCount = productIds.length;
    }

    if (data.categoryId === '') {
      data.categoryId = null;
    }

    const item = await Featured.findOneAndUpdate(
      { _id: id },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    )
      .populate('categoryId', 'name type slug')
      .populate('menuItemIds', 'title')
      .populate('productIds', '_id basicInfo pricing images colorImages')
      .lean();

    if (!item) {
      throw new ApiError(404, 'Featured item not found');
    }

    const products = item.productIds || [];
    const pIds = products.map((p) => (p._id ? p._id.toString() : p.toString()));

    return {
      ...item,
      productCount: item.productCount || pIds.length,
      products,
      productIds: pIds,
    };
  }

  // ------------------------------- reorder featured items ----------------------------
  async reorder(items) {
    if (Array.isArray(items)) {
      const bulkOps = items.map((it, idx) => ({
        updateOne: {
          filter: { _id: it.id || it._id },
          update: { $set: { order: typeof it.order === 'number' ? it.order : idx } },
        },
      }));
      if (bulkOps.length > 0) {
        await Featured.bulkWrite(bulkOps);
      }
    }
    return { success: true };
  }

  // ------------------------------- delete featured item ----------------------------
  async delete(id) {
    const item = await Featured.findOneAndUpdate(
      { _id: id },
      { $set: { status: 'inactive', 'meta.deletedAt': new Date() } },
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'Featured item not found');
    }

    return { message: 'Featured item deleted successfully', id };
  }
}

module.exports = new FeaturedService();
