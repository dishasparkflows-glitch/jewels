const Category = require('./category.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class CategoryService {
  // ------------------------------- create category ----------------------------
  async create(data) {
    return await Category.create(data);
  }

  // ------------------------------- get one category ----------------------------
  async getOne(id) {
    const item = await Category.findOne({ _id: id, isDeleted: false });
    if (!item) {
      throw new ApiError(404, 'Category not found');
    }
    return item;
  }

  // ------------------------------- get all categories ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { isDeleted: false };

    if (queryParams.type) {
      filter.type = queryParams.type;
    }
    if (queryParams.status) {
      filter.status = queryParams.status;
    }
    if (queryParams.search) {
      filter.name = new RegExp(queryParams.search, 'i');
    }

    const [items, total] = await Promise.all([
      Category.find(filter)
        .sort({ 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Category.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get category lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { isDeleted: false, status: 'active' };

    if (queryParams.type) {
      filter.type = queryParams.type;
    }

    return await Category.find(filter)
      .select('_id name type slug subTypes images')
      .sort({ name: 1 })
      .lean();
  }

  // ------------------------------- update category ----------------------------
  async update(id, data) {
    const item = await Category.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Category not found');
    }

    return item;
  }

  // ------------------------------- delete category ----------------------------
  async delete(id) {
    const item = await Category.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, status: 'inactive' } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'Category not found');
    }

    return { message: 'Category deleted successfully', id };
  }
}

module.exports = new CategoryService();
