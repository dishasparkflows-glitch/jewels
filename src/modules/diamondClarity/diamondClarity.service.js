const DiamondClarity = require('./diamondClarity.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class DiamondClarityService {
  // ------------------------------- create diamond clarity ----------------------------
  async create(data) {
    if (data.name) {
      data.name = data.name.trim();
      const existing = await DiamondClarity.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
      });
      if (existing) {
        throw new ApiError(409, `Diamond clarity "${data.name}" already exists`);
      }
    }
    return await DiamondClarity.create(data);
  }

  // ------------------------------- get one diamond clarity ----------------------------
  async getOne(id) {
    const item = await DiamondClarity.findOne({ _id: id });
    if (!item) {
      throw new ApiError(404, 'Diamond clarity not found');
    }
    return item;
  }

  // ------------------------------- get all diamond clarities ----------------------------
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
      DiamondClarity.find(filter)
        .sort({ 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DiamondClarity.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get diamond clarity lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { 'meta.deletedAt': null, status: 'active' };
    return await DiamondClarity.find(filter)
      .sort({ name: 1 })
      .select('_id name image status')
      .lean();
  }

  // ------------------------------- update diamond clarity ----------------------------
  async update(id, data) {
    if (data.name) {
      data.name = data.name.trim();
      const existing = await DiamondClarity.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        _id: { $ne: id },
      });
      if (existing) {
        throw new ApiError(409, `Diamond clarity "${data.name}" already exists`);
      }
    }

    const item = await DiamondClarity.findOneAndUpdate(
      { _id: id },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Diamond clarity not found');
    }

    return item;
  }

  // ------------------------------- delete diamond clarity ----------------------------
  async delete(id) {
    const item = await DiamondClarity.findOneAndUpdate(
      { _id: id },
      { $set: { status: 'inactive', 'meta.deletedAt': new Date() } },
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'Diamond clarity not found');
    }

    return { message: 'Diamond clarity deleted successfully', id };
  }
}

module.exports = new DiamondClarityService();
