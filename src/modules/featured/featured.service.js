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
    delete data.productCount;
    const productIds = data.productIds || [];
    if (Array.isArray(productIds)) {
      data.productIds = productIds;
    }

    if (!data.display && data.placement) {
      data.display = {
        type: data.placement,
        platform: data.platform || 'web',
        order: data.order || 0,
      };
    } else if (data.display) {
      if (!data.display.type && data.placement) {
        data.display.type = data.placement;
      }
      if (!data.placement && data.display.type) {
        data.placement = data.display.type;
      }
      if (data.display.order !== undefined && data.order === undefined) {
        data.order = data.display.order;
      }
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
      const p = queryParams.placement || queryParams.type;
      filter.$or = [
        { 'display.type': new RegExp(`^${p}$`, 'i') },
        { placement: new RegExp(`^${p}$`, 'i') },
      ];
    }
    if (queryParams.platform && queryParams.platform !== 'all') {
      filter['display.platform'] = queryParams.platform;
    }
    if (queryParams.search) {
      filter.name = new RegExp(queryParams.search, 'i');
    }

    let query = Featured.find(filter)
      .populate('categoryId', 'name type slug')
      .populate('menuItemIds', 'title')
      .populate('productIds', '_id basicInfo pricing images colorImages ornate')
      .sort({ 'display.order': 1, order: 1, 'meta.createdAt': -1 })
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
      filter.status = queryParams.status;
    } else {
      filter.status = 'active';
    }

    if (queryParams.placement || queryParams.type) {
      const p = queryParams.placement || queryParams.type;
      filter.$or = [
        { 'display.type': new RegExp(`^${p}$`, 'i') },
        { placement: new RegExp(`^${p}$`, 'i') },
      ];
    }

    return await Featured.find(filter)
      .sort({ 'display.order': 1, order: 1, name: 1 })
      .select('_id name display placement image order status categoryId')
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
    delete data.productCount;

    if (data.display) {
      if (data.display.type && !data.placement) data.placement = data.display.type;
      if (data.display.order !== undefined) data.order = data.display.order;
    } else if (data.placement) {
      data.display = {
        type: data.placement,
        platform: data.platform || 'web',
        order: data.order || 0,
      };
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
      productCount: pIds.length,
      products: populatedProducts,
      productIds: pIds,
    };
  }

  // ------------------------------- reorder featured items ----------------------------
  async reorder(items) {
    if (Array.isArray(items)) {
      const bulkOps = items.map((it, idx) => {
        const ord = typeof it.order === 'number' ? it.order : idx;
        return {
          updateOne: {
            filter: { _id: it.id || it._id },
            update: { $set: { order: ord, 'display.order': ord } },
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
