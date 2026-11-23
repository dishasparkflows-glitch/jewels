const GemstoneShape = require('./gemstoneShape.model');
const { escapeRegex } = require('../../utils/string');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class GemstoneShapeService {
  // ------------------------------- create gemstone shape ----------------------------
  async create(data) {
    if (data.name) {
      data.name = data.name.trim();
      const existing = await GemstoneShape.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        'meta.deletedAt': null,
      });
      if (existing) {
        throw new ApiError(409, `Gemstone shape "${data.name}" already exists`);
      }
    }
    if (!data.code && data.name) {
      data.code = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    return await GemstoneShape.create(data);
  }

  // ------------------------------- get one gemstone shape ----------------------------
  async getOne(id) {
    const item = await GemstoneShape.findOne({ _id: id, 'meta.deletedAt': null });
    if (!item) {
      throw new ApiError(404, 'Gemstone shape not found');
    }
    return item;
  }

  // ------------------------------- get all gemstone shapes ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    if (queryParams.search) {
      filter.$or = [
        { name: new RegExp(escapeRegex(queryParams.search.trim()), 'i') },
        { code: new RegExp(escapeRegex(queryParams.search.trim()), 'i') },
      ];
    }

    const [items, total] = await Promise.all([
      GemstoneShape.find(filter)
        .sort({ order: 1, name: 1, 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      GemstoneShape.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get gemstone shape lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { 'meta.deletedAt': null, status: 'active' };
    return await GemstoneShape.find(filter)
      .sort({ order: 1, name: 1 })
      .select('_id name code iconSvg image order status')
      .lean();
  }

  // ------------------------------- update gemstone shape ----------------------------
  async update(id, data) {
    if (data.name) {
      data.name = data.name.trim();
      const existing = await GemstoneShape.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        _id: { $ne: id },
        'meta.deletedAt': null,
      });
      if (existing) {
        throw new ApiError(409, `Gemstone shape "${data.name}" already exists`);
      }
      if (!data.code) {
        data.code = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      }
    }

    data['meta.updatedAt'] = new Date();

    const item = await GemstoneShape.findOneAndUpdate(
      { _id: id, 'meta.deletedAt': null },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Gemstone shape not found');
    }

    return item;
  }

  // ------------------------------- delete gemstone shape ----------------------------
  async delete(id) {
    const item = await GemstoneShape.findOneAndUpdate(
      { _id: id },
      { $set: { status: 'inactive', 'meta.deletedAt': new Date() } },
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'Gemstone shape not found');
    }

    return { message: 'Gemstone shape deleted successfully', id };
  }

  // ------------------------------- bulk delete gemstone shapes ----------------------------
  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, 'Please provide an array of gemstone shape IDs to delete');
    }

    const result = await GemstoneShape.updateMany(
      { _id: { $in: ids } },
      { $set: { status: 'inactive', 'meta.deletedAt': new Date() } }
    );

    return {
      message: `${result.modifiedCount} gemstone shape(s) deleted successfully`,
      deletedCount: result.modifiedCount,
      ids,
    };
  }
}

module.exports = new GemstoneShapeService();
