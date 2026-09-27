const MenuItem = require('./menuItem.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class MenuItemService {
  // ------------------------------- create menu item ----------------------------
  async create(data) {
    return await MenuItem.create(data);
  }

  // ------------------------------- get one menu item ----------------------------

  async getOne(id) {
    const item = await MenuItem.findOne({ _id: id, isDeleted: false })
      .populate('menuSectionId', 'title categoryId')
      .lean();

    if (!item) {
      throw new ApiError(404, 'Menu item not found');
    }
    return item;
  }

  // ------------------------------- get all menu items ----------------------------

  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { isDeleted: false };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }
    if (queryParams.menuSectionId) {
      filter.menuSectionId = queryParams.menuSectionId;
    }
    if (queryParams.search) {
      filter.title = new RegExp(queryParams.search, 'i');
    }

    const [items, total] = await Promise.all([
      MenuItem.find(filter)
        .populate('menuSectionId', 'title categoryId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MenuItem.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get menu item lookup ----------------------------

  async getLookup(queryParams = {}) {
    const filter = { isDeleted: false, status: 'active' };
    if (queryParams.menuSectionId) {
      filter.menuSectionId = queryParams.menuSectionId;
    }

    return await MenuItem.find(filter)
      .populate('menuSectionId', 'title categoryId')
      .sort({ title: 1 })
      .select('_id title icon menuSectionId status')
      .lean();
  }

  // ------------------------------- update menu item ----------------------------

  async update(id, data) {
    const item = await MenuItem.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    ).populate('menuSectionId', 'title categoryId');

    if (!item) {
      throw new ApiError(404, 'Menu item not found');
    }

    return item;
  }

  // ------------------------------- delete menu item ----------------------------

  async delete(id) {
    const item = await MenuItem.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, status: 'inactive' } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'Menu item not found');
    }

    return { message: 'Menu item deleted successfully', id };
  }
}

module.exports = new MenuItemService();
