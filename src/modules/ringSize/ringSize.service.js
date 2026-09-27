const RingSize = require('./ringSize.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class RingSizeService {
  // ------------------------------- create ring size ----------------------------
  async create(data) {
    if (data.name) {
      data.name = data.name.trim();
      const existing = await RingSize.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        isDeleted: false,
      });
      if (existing) {
        throw new ApiError(409, `Ring size "${data.name}" already exists`);
      }
    }
    return await RingSize.create(data);
  }

  // ------------------------------- get one ring size ----------------------------

  async getOne(id) {
    const item = await RingSize.findOne({ _id: id, isDeleted: false });
    if (!item) {
      throw new ApiError(404, 'Ring size not found');
    }
    return item;
  }

  // ------------------------------- get all ring sizes ----------------------------

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
      RingSize.find(filter)
        .sort({ name: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      RingSize.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get ring size lookup ----------------------------

  async getLookup(queryParams = {}) {
    const filter = { isDeleted: false, status: 'active' };
    return await RingSize.find(filter)
      .sort({ name: 1 })
      .select('_id name status')
      .lean();
  }

  // ------------------------------- update ring size ----------------------------

  async update(id, data) {
    if (data.name) {
      data.name = data.name.trim();
      const existing = await RingSize.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        _id: { $ne: id },
        isDeleted: false,
      });
      if (existing) {
        throw new ApiError(409, `Ring size "${data.name}" already exists`);
      }
    }

    const item = await RingSize.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Ring size not found');
    }

    return item;
  }

  // ------------------------------- delete ring size ----------------------------

  async delete(id) {
    const item = await RingSize.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, status: 'inactive' } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'Ring size not found');
    }

    return { message: 'Ring size deleted successfully', id };
  }
}

module.exports = new RingSizeService();
