const GemstoneType = require('./gemstoneType.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class GemstoneTypeService {
  // ------------------------------- create gemstone type ----------------------------
  async create(data) {
    if (data.name) {
      data.name = data.name.trim();
      const existing = await GemstoneType.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        'meta.deletedAt': null,
      });
      if (existing) {
        throw new ApiError(409, `Gemstone type "${data.name}" already exists`);
      }
    }
    if (!data.slug && data.name) {
      data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    return await GemstoneType.create(data);
  }

  // ------------------------------- get one gemstone type ----------------------------
  async getOne(id) {
    const item = await GemstoneType.findOne({ _id: id, 'meta.deletedAt': null });
    if (!item) {
      throw new ApiError(404, 'Gemstone type not found');
    }
    return item;
  }

  // ------------------------------- get all gemstone types ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    if (queryParams.search) {
      filter.$or = [
        { name: new RegExp(queryParams.search, 'i') },
        { birthstoneMonth: new RegExp(queryParams.search, 'i') },
      ];
    }

    const [items, total] = await Promise.all([
      GemstoneType.find(filter)
        .sort({ order: 1, name: 1, 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      GemstoneType.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get gemstone type lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { 'meta.deletedAt': null, status: 'active' };
    return await GemstoneType.find(filter)
      .sort({ order: 1, name: 1 })
      .select('_id name slug colorCode colorCodeEnd swatchImage image birthstoneMonth status')
      .lean();
  }

  // ------------------------------- update gemstone type ----------------------------
  async update(id, data) {
    if (data.name) {
      data.name = data.name.trim();
      const existing = await GemstoneType.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        _id: { $ne: id },
        'meta.deletedAt': null,
      });
      if (existing) {
        throw new ApiError(409, `Gemstone type "${data.name}" already exists`);
      }
      if (!data.slug) {
        data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      }
    }

    data['meta.updatedAt'] = new Date();

    const item = await GemstoneType.findOneAndUpdate(
      { _id: id, 'meta.deletedAt': null },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Gemstone type not found');
    }

    return item;
  }

  // ------------------------------- delete gemstone type ----------------------------
  async delete(id) {
    const item = await GemstoneType.findOneAndUpdate(
      { _id: id },
      { $set: { status: 'inactive', 'meta.deletedAt': new Date() } },
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'Gemstone type not found');
    }

    return { message: 'Gemstone type deleted successfully', id };
  }

  // ------------------------------- bulk delete gemstone types ----------------------------
  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, 'Please provide an array of gemstone type IDs to delete');
    }

    const result = await GemstoneType.updateMany(
      { _id: { $in: ids } },
      { $set: { status: 'inactive', 'meta.deletedAt': new Date() } }
    );

    return {
      message: `${result.modifiedCount} gemstone type(s) deleted successfully`,
      deletedCount: result.modifiedCount,
      ids,
    };
  }
}

module.exports = new GemstoneTypeService();
