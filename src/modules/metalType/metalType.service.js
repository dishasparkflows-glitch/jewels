const MetalType = require('./metalType.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class MetalTypeService {
  // ------------------------------- create metal type ----------------------------
  async create(data) {
    if (data.name) {
      data.name = data.name.trim();
      const existing = await MetalType.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        isDeleted: false,
      });
      if (existing) {
        throw new ApiError(409, `Metal type "${data.name}" already exists`);
      }
    }
    return await MetalType.create(data);
  }

  // ------------------------------- get one metal type ----------------------------
  async getOne(id) {
    const item = await MetalType.findOne({ _id: id, isDeleted: false });
    if (!item) {
      throw new ApiError(404, 'Metal type not found');
    }
    return item;
  }

  // ------------------------------- get all metal types ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { isDeleted: false };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }
    if (queryParams.metalColor) {
      filter.metalColor = queryParams.metalColor;
    }
    if (queryParams.karat) {
      filter.karat = Number(queryParams.karat);
    }
    if (queryParams.search) {
      filter.$or = [
        { name: new RegExp(queryParams.search, 'i') },
        { metalColor: new RegExp(queryParams.search, 'i') },
      ];
    }

    const [items, total] = await Promise.all([
      MetalType.find(filter)
        .sort({ karat: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MetalType.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get metal type lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { isDeleted: false, status: 'active' };
    if (queryParams.metalColor) {
      filter.metalColor = queryParams.metalColor;
    }

    return await MetalType.find(filter)
      .sort({ karat: -1, name: 1 })
      .select('_id name karat metalColor image status')
      .lean();
  }

  // ------------------------------- update metal type ----------------------------
  async update(id, data) {
    if (data.name) {
      data.name = data.name.trim();
      const existing = await MetalType.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        _id: { $ne: id },
        isDeleted: false,
      });
      if (existing) {
        throw new ApiError(409, `Metal type "${data.name}" already exists`);
      }
    }

    const item = await MetalType.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Metal type not found');
    }

    return item;
  }

  // ------------------------------- delete metal type ----------------------------
  async delete(id) {
    const item = await MetalType.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, status: 'inactive' } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'Metal type not found');
    }

    return { message: 'Metal type deleted successfully', id };
  }
}

module.exports = new MetalTypeService();
