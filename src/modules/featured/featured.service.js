const Featured = require('./featured.model');
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

    delete data.products;
    const productIds = data.productIds || [];
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
      .populate('productIds', '_id basicInfo pricing images colorImages ornate')
      .lean();
    if (!item) {
      throw new ApiError(404, 'Featured item not found');
    }
    const products = item.productIds || [];
    const pIds = products.map((p) => (p._id ? p._id.toString() : p.toString()));
    const populatedProducts = products.filter((p) => p && typeof p === 'object' && p._id);

    return {
      ...item,
      productCount: item.productCount || pIds.length,
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
    if (queryParams.placement) {
      filter.placement = new RegExp(`^${queryParams.placement}$`, 'i');
    }
    if (queryParams.search) {
      filter.name = new RegExp(queryParams.search, 'i');
    }

    let query = Featured.find(filter)
      .populate('categoryId', 'name type slug')
      .populate('menuItemIds', 'title')
      .populate('productIds', '_id basicInfo pricing images colorImages ornate')
      .sort({ order: 1, 'meta.createdAt': -1 })
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
        productCount: item.productCount !== undefined && item.productCount !== 0 ? item.productCount : pIds.length,
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

    delete data.products;
    if (Array.isArray(data.productIds)) {
      data.productCount = data.productIds.length;
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
      .populate('productIds', '_id basicInfo pricing images colorImages ornate')
      .lean();

    if (!item) {
      throw new ApiError(404, 'Featured item not found');
    }

    const rawProducts = Array.isArray(item.productIds) ? item.productIds : [];
    const pIds = rawProducts.map((p) => (p && p._id ? p._id.toString() : String(p)));
    const populatedProducts = rawProducts.filter((p) => p && typeof p === 'object' && p._id);

    return {
      ...item,
      productCount: item.productCount || pIds.length,
      products: populatedProducts,
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
