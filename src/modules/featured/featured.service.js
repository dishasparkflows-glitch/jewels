const Featured = require('./featured.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class FeaturedService {
  // ------------------------------- create featured item ----------------------------
  async create(data) {
    if (data.name) {
      data.name = data.name.trim();
      const existing = await Featured.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        isDeleted: false,
      });
      if (existing) {
        throw new ApiError(409, `Featured item "${data.name}" already exists`);
      }
    }

    const productIds = data.products || [];
    if (Array.isArray(productIds) && productIds.length > 0) {
      data.productCount = productIds.length;
    }

    const item = await Featured.create(data);

    if (Array.isArray(productIds) && productIds.length > 0) {
      const Product = require('../product/product.model');
      await Product.updateMany(
        { _id: { $in: productIds } },
        { $addToSet: { featured: item._id } }
      );
    }

    return item;
  }

  // ------------------------------- get one featured item ----------------------------

  async getOne(id) {
    const item = await Featured.findOne({ _id: id, isDeleted: false }).lean();
    if (!item) {
      throw new ApiError(404, 'Featured item not found');
    }
    const Product = require('../product/product.model');
    const matchingProducts = await Product.find({
      featured: id,
      isDeleted: false,
    }).select('_id title sku price images').lean();

    return {
      ...item,
      productCount: item.productCount || matchingProducts.length,
      products: matchingProducts,
      productIds: matchingProducts.map((p) => p._id.toString()),
    };
  }

  // ------------------------------- get all featured items ----------------------------

  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { isDeleted: false };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }
    if (queryParams.placement) {
      filter.placement = new RegExp(`^${queryParams.placement}$`, 'i');
    }
    if (queryParams.search) {
      filter.name = new RegExp(queryParams.search, 'i');
    }

    const [items, total] = await Promise.all([
      Featured.find(filter)
        .sort({ order: 1, 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Featured.countDocuments(filter),
    ]);

    const Product = require('../product/product.model');
    const itemsWithCounts = await Promise.all(
      items.map(async (item) => {
        const matchingProducts = await Product.find({
          featured: item._id,
          isDeleted: false,
        }).select('_id').lean();
        return {
          ...item,
          productCount: item.productCount !== undefined && item.productCount !== 0 ? item.productCount : matchingProducts.length,
          productIds: matchingProducts.map((p) => p._id.toString()),
        };
      })
    );

    return { items: itemsWithCounts, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get featured item lookup ----------------------------

  async getLookup(queryParams = {}) {
    const filter = { isDeleted: false, status: 'active' };
    if (queryParams.placement) {
      filter.placement = new RegExp(`^${queryParams.placement}$`, 'i');
    }

    return await Featured.find(filter)
      .sort({ order: 1, name: 1 })
      .select('_id name placement image position status productCount')
      .lean();
  }

  // ------------------------------- update featured item ----------------------------

  async update(id, data) {
    if (data.name) {
      data.name = data.name.trim();
      const existing = await Featured.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        _id: { $ne: id },
        isDeleted: false,
      });
      if (existing) {
        throw new ApiError(409, `Featured item "${data.name}" already exists`);
      }
    }

    const productIds = data.products;
    if (Array.isArray(productIds)) {
      data.productCount = productIds.length;
      const Product = require('../product/product.model');
      await Product.updateMany(
        { featured: id, _id: { $nin: productIds } },
        { $pull: { featured: id } }
      );
      await Product.updateMany(
        { _id: { $in: productIds } },
        { $addToSet: { featured: id } }
      );
    }

    const item = await Featured.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Featured item not found');
    }

    return item;
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
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, status: 'inactive' } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'Featured item not found');
    }

    const Product = require('../product/product.model');
    await Product.updateMany({ featured: id }, { $pull: { featured: id } });

    return { message: 'Featured item deleted successfully', id };
  }
}

module.exports = new FeaturedService();
