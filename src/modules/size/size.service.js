const Size = require('./size.model');
require('../category/category.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class SizeService {
  // ------------------------------- create size ----------------------------
  async create(data) {
    const categoryId = data.categoryId || data.category;
    const subTypeId = data.subTypeId || data.subType || null;

    if (data.name && categoryId) {
      data.name = data.name.trim();
      const existing = await Size.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        categoryId,
        subTypeId,
        isDeleted: false,
      });
      if (existing) {
        throw new ApiError(
          409,
          `Size "${data.name}" already exists for this category/sub-type`
        );
      }
    }

    if (categoryId) data.categoryId = categoryId;
    if (subTypeId) data.subTypeId = subTypeId;
    delete data.category;
    delete data.subType;

    return await Size.create(data);
  }

  // ------------------------------- get one size ----------------------------

  async getOne(id) {
    const item = await Size.findOne({ _id: id, isDeleted: false })
      .populate('categoryId', 'name slug type')
      .lean();

    if (!item) {
      throw new ApiError(404, 'Size not found');
    }
    return item;
  }

  // ------------------------------- get all sizes ----------------------------

  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { isDeleted: false };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }
    const categoryId = queryParams.categoryId || queryParams.category;
    if (categoryId) {
      filter.categoryId = categoryId;
    }
    const subTypeId = queryParams.subTypeId || queryParams.subType;
    if (subTypeId) {
      filter.subTypeId = subTypeId;
    }
    if (queryParams.search) {
      filter.name = new RegExp(queryParams.search, 'i');
    }

    const [items, total] = await Promise.all([
      Size.find(filter)
        .populate('categoryId', 'name slug type')
        .sort({ 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Size.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get size lookup ----------------------------

  async getLookup(queryParams = {}) {
    const filter = { isDeleted: false, status: 'active' };
    const categoryId = queryParams.categoryId || queryParams.category;
    if (categoryId) {
      filter.categoryId = categoryId;
    }
    const subTypeId = queryParams.subTypeId || queryParams.subType;
    if (subTypeId) {
      filter.subTypeId = subTypeId;
    }

    return await Size.find(filter)
      .populate('categoryId', 'name slug type')
      .sort({ name: 1 })
      .select('_id name categoryId subTypeId status')
      .lean();
  }

  // ------------------------------- update size ----------------------------

  async update(id, data) {
    const categoryId = data.categoryId || data.category;
    const subTypeId = data.subTypeId !== undefined ? data.subTypeId : data.subType;

    if (data.name && categoryId) {
      data.name = data.name.trim();
      const existing = await Size.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        categoryId,
        subTypeId: subTypeId || null,
        _id: { $ne: id },
        isDeleted: false,
      });
      if (existing) {
        throw new ApiError(
          409,
          `Size "${data.name}" already exists for this category/sub-type`
        );
      }
    }

    if (categoryId) data.categoryId = categoryId;
    if (subTypeId !== undefined) data.subTypeId = subTypeId;
    delete data.category;
    delete data.subType;

    const item = await Size.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    ).populate('categoryId', 'name slug type');

    if (!item) {
      throw new ApiError(404, 'Size not found');
    }

    return item;
  }

  // ------------------------------- delete size ----------------------------

  async delete(id) {
    const item = await Size.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, status: 'inactive' } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'Size not found');
    }

    return { message: 'Size deleted successfully', id };
  }
}

module.exports = new SizeService();
