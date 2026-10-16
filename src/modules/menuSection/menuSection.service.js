const MenuItem = require('../menuItem/menuItem.model');
const Category = require('../category/category.model');
const requireParent = require('../../utils/menuParents');
const MenuSection = require('./menuSection.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class MenuSectionService {
  // ------------------------------- create menu section ----------------------------
  async create(data) {
    await requireParent(Category, data.categoryId, 'Category');
    return await MenuSection.create(data);
  }

  // ------------------------------- get one menu section ----------------------------
  async getOne(id) {
    const item = await MenuSection.findOne({ _id: id, 'meta.deletedAt': null })
      .populate('categoryId', 'name slug type')
      .lean();

    if (!item) {
      throw new ApiError(404, 'Menu section not found');
    }
    return item;
  }

  // ------------------------------- get all menu sections ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }
    if (queryParams.categoryId) {
      filter.categoryId = queryParams.categoryId;
    }
    if (queryParams.search) {
      filter.title = new RegExp(queryParams.search, 'i');
    }

    const [items, total] = await Promise.all([
      MenuSection.find(filter)
        .populate('categoryId', 'name slug type')
        .sort({ order: 1, 'meta.createdAt': 1, _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MenuSection.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get menu section lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { 'meta.deletedAt': null, status: 'active' };
    if (queryParams.categoryId) {
      filter.categoryId = queryParams.categoryId;
    }

    return await MenuSection.find(filter)
      .populate('categoryId', 'name slug type')
      .sort({ order: 1, title: 1 })
      .select('_id title categoryId status')
      .lean();
  }

  // ------------------------------- update menu section ----------------------------
  async update(id, data) {
    if (data.categoryId !== undefined) await requireParent(Category, data.categoryId, 'Category');
    const item = await MenuSection.findOneAndUpdate(
      { _id: id },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    ).populate('categoryId', 'name slug type');

    if (!item) {
      throw new ApiError(404, 'Menu section not found');
    }

    return item;
  }

  // ------------------------------- reorder menu sections ----------------------------
  async reorder(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new ApiError(400, 'Items array is required for reordering');
    }

    const bulkOps = items.map((item, index) => {
      const id = typeof item === 'string' ? item : item.id || item._id;
      const order = typeof item === 'object' && item.order !== undefined ? item.order : index + 1;
      return {
        updateOne: {
          filter: { _id: id },
          update: { $set: { order } },
        },
      };
    });

    await MenuSection.bulkWrite(bulkOps);
    return { success: true, count: items.length };
  }

  // ------------------------------- delete menu section ----------------------------
  async delete(id) {
    const item = await MenuSection.findOneAndUpdate(
      { _id: id },
      { $set: { status: 'inactive', 'meta.deletedAt': new Date() } },
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'Menu section not found');
    }

    await MenuItem.updateMany(
      { menuSectionId: id, 'meta.deletedAt': null },
      { $set: { status: 'inactive', 'meta.deletedAt': new Date() } }
    );
    return { message: 'Menu section deleted successfully', id };
  }
}

module.exports = new MenuSectionService();
