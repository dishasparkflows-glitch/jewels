const CaratWeight = require('./caratWeight.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class CaratWeightService {
  // ------------------------------- create carat weight ----------------------------
  async create(data) {
    const existing = await CaratWeight.findOne({ name: data.name, isDeleted: false });
    if (existing) {
      throw new ApiError(409, `Carat weight "${data.name}" already exists`);
    }
    return await CaratWeight.create(data);
  }

  // ------------------------------- get one carat weight ----------------------------

  async getOne(id) {
    const item = await CaratWeight.findOne({ _id: id, isDeleted: false });
    if (!item) {
      throw new ApiError(404, 'Carat weight not found');
    }
    return item;
  }

  // ------------------------------- get all carat weights ----------------------------

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
      CaratWeight.find(filter)
        .sort({ order: 1, name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CaratWeight.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get carat weight lookup ----------------------------

  async getLookup(queryParams = {}) {
    const filter = { isDeleted: false, status: 'active' };

    return await CaratWeight.find(filter)
      .select('_id name weight image')
      .sort({ order: 1, name: 1 })
      .lean();
  }

  // ------------------------------- update carat weight ----------------------------

  async update(id, data) {
    if (data.name) {
      const duplicate = await CaratWeight.findOne({
        name: data.name,
        _id: { $ne: id },
        isDeleted: false,
      });
      if (duplicate) {
        throw new ApiError(409, `Carat weight "${data.name}" already exists`);
      }
    }

    const item = await CaratWeight.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Carat weight not found');
    }

    return item;
  }

  // ------------------------------- delete carat weight ----------------------------

  async delete(id) {
    const item = await CaratWeight.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, status: 'inactive' } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'Carat weight not found');
    }

    return { message: 'Carat weight deleted successfully', id };
  }
}

module.exports = new CaratWeightService();
