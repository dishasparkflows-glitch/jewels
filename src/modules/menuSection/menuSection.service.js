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
    const item = await MenuSection.findOne({ _id: id, isDeleted: false })
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
    const filter = { isDeleted: false, status: 'active' };
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
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    ).populate('categoryId', 'name slug type');

    if (!item) {
      throw new ApiError(404, 'Menu section not found');
    }

    return item;
  }

  // ------------------------------- delete menu section ----------------------------
  async delete(id) {
    const item = await MenuSection.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, status: 'inactive' } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'Menu section not found');
    }

    await MenuItem.updateMany({ menuSectionId: id, 'meta.deletedAt': null }, { $set: { isDeleted: true, status: 'inactive' } });
    return { message: 'Menu section deleted successfully', id };
  }
}

module.exports = new MenuSectionService();
