const DiamondShape = require('./diamondShape.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class DiamondShapeService {
  // ------------------------------- create diamond shape ----------------------------
  async create(data) {
    if (data.name) {
      data.name = data.name.trim();
      const existing = await DiamondShape.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
      });
      if (existing) {
        throw new ApiError(409, `Diamond shape "${data.name}" already exists`);
      }
    }
    return await DiamondShape.create(data);
  }

  // ------------------------------- get one diamond shape ----------------------------
  async getOne(id) {
    const item = await DiamondShape.findOne({ _id: id });
    if (!item) {
      throw new ApiError(404, 'Diamond shape not found');
    }
    return item;
  }

  // ------------------------------- get all diamond shapes ----------------------------
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
      DiamondShape.find(filter)
        .sort({ 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DiamondShape.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get diamond shape lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { 'meta.deletedAt': null, status: 'active' };
    return await DiamondShape.find(filter)
      .sort({ name: 1 })
      .select('_id name image status')
      .lean();
  }

  // ------------------------------- update diamond shape ----------------------------
  async update(id, data) {
    if (data.name) {
      data.name = data.name.trim();
      const existing = await DiamondShape.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        _id: { $ne: id },
      });
      if (existing) {
        throw new ApiError(409, `Diamond shape "${data.name}" already exists`);
      }
    }

    const item = await DiamondShape.findOneAndUpdate(
      { _id: id },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Diamond shape not found');
    }

    return item;
  }

  // ------------------------------- delete diamond shape ----------------------------
  async delete(id) {
    const item = await DiamondShape.findOneAndUpdate(
      { _id: id },
      { $set: { status: 'inactive', 'meta.deletedAt': new Date() } },
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'Diamond shape not found');
    }

    return { message: 'Diamond shape deleted successfully', id };
  }
}

module.exports = new DiamondShapeService();
