const DiamondColor = require('./diamondColor.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class DiamondColorService {
  // ------------------------------- create diamond color ----------------------------
  async create(data) {
    if (data.name) {
      data.name = data.name.trim();
      const existing = await DiamondColor.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        isDeleted: false,
      });
      if (existing) {
        throw new ApiError(409, `Diamond color "${data.name}" already exists`);
      }
    }
    return await DiamondColor.create(data);
  }

  // ------------------------------- get one diamond color ----------------------------
  async getOne(id) {
    const item = await DiamondColor.findOne({ _id: id, isDeleted: false });
    if (!item) {
      throw new ApiError(404, 'Diamond color not found');
    }
    return item;
  }

  // ------------------------------- get all diamond colors ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { isDeleted: false };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    if (queryParams.search) {
      filter.name = new RegExp(queryParams.search, 'i');
    }

    const [items, total] = await Promise.all([
      DiamondColor.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DiamondColor.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get diamond color lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { isDeleted: false, status: 'active' };
    return await DiamondColor.find(filter)
      .sort({ name: 1 })
      .select('_id name image status')
      .lean();
  }

  // ------------------------------- update diamond color ----------------------------
  async update(id, data) {
    if (data.name) {
      data.name = data.name.trim();
      const existing = await DiamondColor.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        _id: { $ne: id },
        isDeleted: false,
      });
      if (existing) {
        throw new ApiError(409, `Diamond color "${data.name}" already exists`);
      }
    }

    const item = await DiamondColor.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Diamond color not found');
    }

    return item;
  }

  // ------------------------------- delete diamond color ----------------------------
  async delete(id) {
    const item = await DiamondColor.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, status: 'inactive' } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'Diamond color not found');
    }

    return { message: 'Diamond color deleted successfully', id };
  }
}

module.exports = new DiamondColorService();
