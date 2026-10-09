const SieveSize = require('./sieveSize.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const { escapeRegex } = require('../../utils/string');

class SieveSizeService {
  // ------------------------------- create sieve size ----------------------------
  async create(data) {
    if (data.name) {
      data.name = data.name.trim();
      const safePattern = escapeRegex(data.name);
      const existing = await SieveSize.findOne({
        name: new RegExp(`^${safePattern}$`, 'i'),
        isDeleted: false,
      });
      if (existing) {
        throw new ApiError(409, `Sieve size "${data.name}" already exists`);
      }
    }
    return await SieveSize.create(data);
  }

  // ------------------------------- get one sieve size ----------------------------

  async getOne(id) {
    const item = await SieveSize.findOne({ _id: id, isDeleted: false });
    if (!item) {
      throw new ApiError(404, 'Sieve size not found');
    }
    return item;
  }

  // ------------------------------- get all sieve sizes ----------------------------

  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { isDeleted: false };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    if (queryParams.search) {
      filter.name = new RegExp(escapeRegex(queryParams.search), 'i');
    }

    const [items, total] = await Promise.all([
      SieveSize.find(filter)
        .sort({ name: 1, 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SieveSize.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get sieve size lookup ----------------------------

  async getLookup(queryParams = {}) {
    const filter = { isDeleted: false, status: 'active' };
    return await SieveSize.find(filter)
      .sort({ name: 1 })
      .select('_id name status')
      .lean();
  }

  // ------------------------------- update sieve size ----------------------------

  async update(id, data) {
    if (data.name) {
      data.name = data.name.trim();
      const safePattern = escapeRegex(data.name);
      const existing = await SieveSize.findOne({
        name: new RegExp(`^${safePattern}$`, 'i'),
        _id: { $ne: id },
        isDeleted: false,
      });
      if (existing) {
        throw new ApiError(409, `Sieve size "${data.name}" already exists`);
      }
    }

    const item = await SieveSize.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Sieve size not found');
    }

    return item;
  }

  // ------------------------------- delete sieve size ----------------------------

  async delete(id) {
    const item = await SieveSize.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, status: 'inactive' } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'Sieve size not found');
    }

    return { message: 'Sieve size deleted successfully', id };
  }
}

module.exports = new SieveSizeService();
