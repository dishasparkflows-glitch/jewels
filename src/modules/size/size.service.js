const Size = require('./size.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class SizeService {
  // ------------------------------- create size ----------------------------
  async create(data) {
    if (data.name && data.category) {
      data.name = data.name.trim();
      const existing = await Size.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        category: data.category,
        subType: data.subType || null,
        isDeleted: false,
      });
      if (existing) {
        throw new ApiError(
          409,
          `Size "${data.name}" already exists for this category/sub-type`
        );
      }
    }
    return await Size.create(data);
  }

  // ------------------------------- get one size ----------------------------

  async getOne(id) {
    const item = await Size.findOne({ _id: id, isDeleted: false })
      .populate('category', 'name slug type')
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
    if (queryParams.category) {
      filter.category = queryParams.category;
    }
    if (queryParams.subType) {
      filter.subType = queryParams.subType;
    }
    if (queryParams.search) {
      filter.name = new RegExp(queryParams.search, 'i');
    }

    const [items, total] = await Promise.all([
      Size.find(filter)
        .populate('category', 'name slug type')
        .sort({ createdAt: -1 })
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
    if (queryParams.category) {
      filter.category = queryParams.category;
    }
    if (queryParams.subType) {
      filter.subType = queryParams.subType;
    }

    return await Size.find(filter)
      .populate('category', 'name slug type')
      .sort({ name: 1 })
      .select('_id name category subType status')
      .lean();
  }

  // ------------------------------- update size ----------------------------

  async update(id, data) {
    if (data.name && data.category) {
      data.name = data.name.trim();
      const existing = await Size.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        category: data.category,
        subType: data.subType || null,
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

    const item = await Size.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    ).populate('category', 'name slug type');

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
