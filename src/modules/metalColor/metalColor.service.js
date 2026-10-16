const MetalColor = require('./metalColor.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class MetalColorService {
  // ------------------------------- create metal color ----------------------------
  async create(data) {
    if (data.name) {
      data.name = data.name.trim();
      const existing = await MetalColor.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
      });
      if (existing) {
        throw new ApiError(409, `Metal color "${data.name}" already exists`);
      }
    }
    return await MetalColor.create(data);
  }

  // ------------------------------- get one metal color ----------------------------
  async getOne(id) {
    const item = await MetalColor.findOne({ _id: id });
    if (!item) {
      throw new ApiError(404, 'Metal color not found');
    }
    return item;
  }

  // ------------------------------- get all metal colors ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    if (queryParams.search) {
      filter.name = new RegExp(queryParams.search, 'i');
    }

    const [items, total] = await Promise.all([
      MetalColor.find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MetalColor.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get metal color lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { 'meta.deletedAt': null, status: 'active' };
    return await MetalColor.find(filter)
      .sort({ name: 1 })
      .select('_id name colorCode colorCodeEnd status')
      .lean();
  }

  // ------------------------------- update metal color ----------------------------
  async update(id, data) {
    if (data.name) {
      data.name = data.name.trim();
      const existing = await MetalColor.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        _id: { $ne: id },
      });
      if (existing) {
        throw new ApiError(409, `Metal color "${data.name}" already exists`);
      }
    }

    const item = await MetalColor.findOneAndUpdate(
      { _id: id },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Metal color not found');
    }

    return item;
  }

  // ------------------------------- delete metal color ----------------------------
  async delete(id) {
    const item = await MetalColor.findOneAndUpdate(
      { _id: id },
      { $set: { status: 'inactive', 'meta.deletedAt': new Date() } },
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'Metal color not found');
    }

    return { message: 'Metal color deleted successfully', id };
  }
}

module.exports = new MetalColorService();
