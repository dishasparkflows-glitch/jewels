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
      });
      if (existing) {
        throw new ApiError(409, `Metal purity "${data.name}" already exists`);
      }
    }
    if (data.order !== undefined) {
      data.order = Number(data.order) || 0;
    } else {
      const highest = await MetalPurity.findOne({ 'meta.deletedAt': null }).sort({ order: -1 }).select('order');
      data.order = (highest?.order || 0) + 1;
    }
    return await MetalPurity.create(data);
  }

  // ------------------------------- get one metal purity ----------------------------
  async getOne(id) {
    const item = await MetalPurity.findOne({ _id: id });
    if (!item) {
      throw new ApiError(404, 'Metal purity not found');
    }
    return item;
  }

  // ------------------------------- get all metal purities ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

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
        .sort({ order: 1, karat: 1, name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MetalPurity.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get metal purity lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { 'meta.deletedAt': null, status: 'active' };
    if (queryParams.metalType) {
      filter.metalType = queryParams.metalType;
    }

    return await MetalPurity.find(filter)
      .sort({ order: 1, karat: 1, name: 1 })
      .select('_id name metalType karat order status')
      .lean();
  }

  // ------------------------------- update metal purity ----------------------------
  async update(id, data) {
    if (data.name) {
      data.name = data.name.trim();
      const existing = await MetalPurity.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        _id: { $ne: id },
      });
      if (existing) {
        throw new ApiError(409, `Metal purity "${data.name}" already exists`);
      }
    }
    if (data.order !== undefined) {
      data.order = Number(data.order) || 0;
    }

    const item = await MetalPurity.findOneAndUpdate(
      { _id: id },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Metal purity not found');
    }

    return item;
  }

  // ------------------------------- delete metal purity ----------------------------
  async delete(id) {
    const item = await MetalPurity.findOneAndUpdate(
      { _id: id },
      { $set: { status: 'inactive', 'meta.deletedAt': new Date() } },
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'Metal purity not found');
    }

    return { message: 'Metal purity deleted successfully', id };
  }
}

module.exports = new MetalPurityService();
