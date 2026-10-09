const MetalPurity = require('./metalPurity.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class MetalPurityService {
  // ------------------------------- create metal purity ----------------------------
  async create(data) {
    if (data.name) {
      data.name = data.name.trim();
      const existing = await MetalPurity.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        isDeleted: false,
      });
      if (existing) {
        throw new ApiError(409, `Metal purity "${data.name}" already exists`);
      }
    }
    return await MetalPurity.create(data);
  }

  // ------------------------------- get one metal purity ----------------------------
  async getOne(id) {
    const item = await MetalPurity.findOne({ _id: id, isDeleted: false });
    if (!item) {
      throw new ApiError(404, 'Metal purity not found');
    }
    return item;
  }

  // ------------------------------- get all metal purities ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { isDeleted: false };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }
    if (queryParams.metalType) {
      filter.metalType = queryParams.metalType;
    }
    if (queryParams.search) {
      filter.name = new RegExp(queryParams.search, 'i');
    }

    const [items, total] = await Promise.all([
      MetalPurity.find(filter)
        .sort({ karat: 1, 'meta.createdAt': 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MetalPurity.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get metal purity lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { isDeleted: false, status: 'active' };
    if (queryParams.metalType) {
      filter.metalType = queryParams.metalType;
    }

    return await MetalPurity.find(filter)
      .sort({ karat: -1, name: 1 })
      .select('_id name metalType karat status')
      .lean();
  }

  // ------------------------------- update metal purity ----------------------------
  async update(id, data) {
    if (data.name) {
      data.name = data.name.trim();
      const existing = await MetalPurity.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        _id: { $ne: id },
        isDeleted: false,
      });
      if (existing) {
        throw new ApiError(409, `Metal purity "${data.name}" already exists`);
      }
    }

    const item = await MetalPurity.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Metal purity not found');
    }

    return item;
  }

  // ------------------------------- delete metal purity ----------------------------
  async delete(id) {
    const item = await MetalPurity.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, status: 'inactive' } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'Metal purity not found');
    }

    return { message: 'Metal purity deleted successfully', id };
  }
}

module.exports = new MetalPurityService();
