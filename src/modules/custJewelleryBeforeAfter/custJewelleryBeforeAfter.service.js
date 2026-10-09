const CustJewelleryBeforAfter = require('./custJewelleryBeforeAfter.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class CustJewelleryBeforeAfterService {
  // ------------------------------- create cust jewellery before after ----------------------------
  async create(data) {
    return await CustJewelleryBeforAfter.create(data);
  }

  // ------------------------------- get one cust jewellery before after ----------------------------
  async getOne(id) {
    const item = await CustJewelleryBeforAfter.findOne({ _id: id, isDeleted: false });
    if (!item) {
      throw new ApiError(404, 'Before/After showcase entry not found');
    }
    return item;
  }

  // ------------------------------- get all cust jewellery before after ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { isDeleted: false };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    if (queryParams.search) {
      filter.alt = new RegExp(queryParams.search, 'i');
    }

    const [items, total] = await Promise.all([
      CustJewelleryBeforAfter.find(filter)
        .sort({ position: 1, 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CustJewelleryBeforAfter.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get cust jewellery before after lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { isDeleted: false, status: 'active' };
    return await CustJewelleryBeforAfter.find(filter)
      .sort({ position: 1, 'meta.createdAt': -1 })
      .select('_id beforeImage afterImage alt position')
      .lean();
  }

  // ------------------------------- update cust jewellery before after ----------------------------
  async update(id, data) {
    const item = await CustJewelleryBeforAfter.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Before/After showcase entry not found');
    }

    return item;
  }

  // ------------------------------- delete cust jewellery before after ----------------------------
  async delete(id) {
    const item = await CustJewelleryBeforAfter.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, status: 'inactive' } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'Before/After showcase entry not found');
    }

    return { message: 'Before/After showcase entry deleted successfully', id };
  }
}

module.exports = new CustJewelleryBeforeAfterService();
