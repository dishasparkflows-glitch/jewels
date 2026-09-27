const DiamondType = require('./diamondType.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class DiamondTypeService {
  // ------------------------------- create diamond type ----------------------------
  async create(data) {
    if (data.name) {
      data.name = data.name.trim();
      const existing = await DiamondType.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        isDeleted: false,
      });
      if (existing) {
        throw new ApiError(409, `Diamond type "${data.name}" already exists`);
      }
    }
    return await DiamondType.create(data);
  }

  // ------------------------------- get one diamond type ----------------------------
  async getOne(id) {
    const item = await DiamondType.findOne({ _id: id, isDeleted: false });
    if (!item) {
      throw new ApiError(404, 'Diamond type not found');
    }
    return item;
  }

  // ------------------------------- get all diamond types ----------------------------
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
      DiamondType.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DiamondType.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get diamond type lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { isDeleted: false, status: 'active' };
    return await DiamondType.find(filter)
      .sort({ name: 1 })
      .select('_id name image status')
      .lean();
  }

  // ------------------------------- update diamond type ----------------------------
  async update(id, data) {
    if (data.name) {
      data.name = data.name.trim();
      const existing = await DiamondType.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        _id: { $ne: id },
        isDeleted: false,
      });
      if (existing) {
        throw new ApiError(409, `Diamond type "${data.name}" already exists`);
      }
    }

    const item = await DiamondType.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Diamond type not found');
    }

    return item;
  }

  // ------------------------------- delete diamond type ----------------------------
  async delete(id) {
    const item = await DiamondType.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, status: 'inactive' } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'Diamond type not found');
    }

    return { message: 'Diamond type deleted successfully', id };
  }
}

module.exports = new DiamondTypeService();
