const DiamondSize = require('./diamondSize.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class DiamondSizeService {
  // ------------------------------- create diamond size ----------------------------
  async create(data) {
    if (!data.name && data.sizeFrom !== undefined && data.sizeTo !== undefined) {
      data.name = `${data.sizeFrom} - ${data.sizeTo} mm`;
    }
    if (data.name) {
      data.name = data.name.trim();
      const existing = await DiamondSize.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
      });
      if (existing) {
        throw new ApiError(409, `Diamond size "${data.name}" already exists`);
      }
    }
    return await DiamondSize.create(data);
  }

  // ------------------------------- get one diamond size ----------------------------
  async getOne(id) {
    const item = await DiamondSize.findOne({ _id: id });
    if (!item) {
      throw new ApiError(404, 'Diamond size not found');
    }
    return item;
  }

  // ------------------------------- get all diamond sizes ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    if (queryParams.search) {
      filter.name = new RegExp(queryParams.search, 'i');
    }

    if (queryParams.carat) {
      const c = Number(queryParams.carat);
      filter.sizeFrom = { $lte: c };
      filter.sizeTo = { $gte: c };
    }

    const [items, total] = await Promise.all([
      DiamondSize.find(filter)
        .sort({ sizeFrom: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DiamondSize.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get diamond size lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { 'meta.deletedAt': null, status: 'active' };
    return await DiamondSize.find(filter)
      .sort({ sizeFrom: 1 })
      .select('_id name sizeFrom sizeTo status')
      .lean();
  }

  // ------------------------------- update diamond size ----------------------------
  async update(id, data) {
    if (!data.name && data.sizeFrom !== undefined && data.sizeTo !== undefined) {
      data.name = `${data.sizeFrom} - ${data.sizeTo} mm`;
    }
    if (data.name) {
      data.name = data.name.trim();
      const existing = await DiamondSize.findOne({
        name: new RegExp(`^${data.name}$`, 'i'),
        _id: { $ne: id },
      });
      if (existing) {
        throw new ApiError(409, `Diamond size "${data.name}" already exists`);
      }
    }

    const item = await DiamondSize.findOneAndUpdate(
      { _id: id },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Diamond size not found');
    }

    return item;
  }

  // ------------------------------- delete diamond size ----------------------------
  async delete(id) {
    const item = await DiamondSize.findOneAndUpdate(
      { _id: id },
      { $set: { status: 'inactive', 'meta.deletedAt': new Date() } },
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'Diamond size not found');
    }

    return { message: 'Diamond size deleted successfully', id };
  }
}

module.exports = new DiamondSizeService();
