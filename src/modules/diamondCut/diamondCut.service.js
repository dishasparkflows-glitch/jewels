const DiamondCut = require('./diamondCut.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class DiamondCutService {
  // ------------------------------- create diamond cut ----------------------------
  async create(data) {
    if (data.name) {
      data.name = data.name.trim();
      const existing = await DiamondCut.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        isDeleted: false,
      });
      if (existing) {
        throw new ApiError(409, `Diamond cut "${data.name}" already exists`);
      }
    }
    return await DiamondCut.create(data);
  }

  // ------------------------------- get one diamond cut ----------------------------

  async getOne(id) {
    const item = await DiamondCut.findOne({ _id: id, isDeleted: false });
    if (!item) {
      throw new ApiError(404, 'Diamond cut not found');
    }
    return item;
  }

  // ------------------------------- get all diamond cuts ----------------------------

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
      DiamondCut.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DiamondCut.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get diamond cut lookup ----------------------------

  async getLookup(queryParams = {}) {
    const filter = { isDeleted: false, status: 'active' };
    return await DiamondCut.find(filter)
      .sort({ name: 1 })
      .select('_id name image status')
      .lean();
  }

  // ------------------------------- update diamond cut ----------------------------

  async update(id, data) {
    if (data.name) {
      data.name = data.name.trim();
      const existing = await DiamondCut.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        _id: { $ne: id },
        isDeleted: false,
      });
      if (existing) {
        throw new ApiError(409, `Diamond cut "${data.name}" already exists`);
      }
    }

    const item = await DiamondCut.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Diamond cut not found');
    }

    return item;
  }

  // ------------------------------- delete diamond cut ----------------------------

  async delete(id) {
    const item = await DiamondCut.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, status: 'inactive' } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'Diamond cut not found');
    }

    return { message: 'Diamond cut deleted successfully', id };
  }
}

module.exports = new DiamondCutService();
