const CustomInquiry = require('./customInquiry.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class CustomInquiryService {
  // ------------------------------- create custom inquiry ----------------------------
  async create(data) {
    return await CustomInquiry.create(data);
  }

  // ------------------------------- get one custom inquiry ----------------------------

  async getOne(id) {
    const item = await CustomInquiry.findOne({ _id: id, isDeleted: false });
    if (!item) {
      throw new ApiError(404, 'Custom inquiry not found');
    }
    return item;
  }

  // ------------------------------- get all custom inquiries ----------------------------

  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { isDeleted: false };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }
    if (queryParams.stoneType) {
      filter.stoneType = queryParams.stoneType;
    }
    if (queryParams.metalType) {
      filter.metalType = queryParams.metalType;
    }
    if (queryParams.search) {
      filter.$or = [
        { name: new RegExp(queryParams.search, 'i') },
        { email: new RegExp(queryParams.search, 'i') },
        { phoneNumber: new RegExp(queryParams.search, 'i') },
      ];
    }

    const [items, total] = await Promise.all([
      CustomInquiry.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CustomInquiry.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get custom inquiry lookup ----------------------------

  async getLookup(queryParams = {}) {
    const filter = { isDeleted: false };
    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    return await CustomInquiry.find(filter)
      .sort({ createdAt: -1 })
      .select('_id name email phoneNumber stoneType metalType budget status createdAt')
      .lean();
  }

  // ------------------------------- update custom inquiry ----------------------------

  async update(id, data) {
    const item = await CustomInquiry.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Custom inquiry not found');
    }

    return item;
  }

  // ------------------------------- delete custom inquiry ----------------------------

  async delete(id) {
    const item = await CustomInquiry.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'Custom inquiry not found');
    }

    return { message: 'Custom inquiry deleted successfully', id };
  }
}

module.exports = new CustomInquiryService();
