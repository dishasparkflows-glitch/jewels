const CustomInquiry = require('./customInquiry.model');
const whatsappService = require('../whatsapp/whatsapp.service');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class CustomInquiryService {
  // ------------------------------- create custom inquiry ----------------------------
  async create(data) {
    const created = await CustomInquiry.create(data);

    try {
      await whatsappService.sendCustomInquiryNotification(created);
    } catch (waErr) {
      console.warn('[CustomInquiryService] WhatsApp notification notice:', waErr.message);
    }

    return created;
  }

  // ------------------------------- get one custom inquiry ----------------------------

  async getOne(id) {
    const item = await CustomInquiry.findOne({ _id: id });
    if (!item) {
      throw new ApiError(404, 'Custom inquiry not found');
    }
    return item;
  }

  // ------------------------------- get all custom inquiries ----------------------------

  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }
    if (queryParams.stoneType) {
      filter['requirements.stoneType'] = queryParams.stoneType;
    }
    if (queryParams.metalType) {
      filter['requirements.metalType'] = queryParams.metalType;
    }
    if (queryParams.search) {
      const reg = new RegExp(queryParams.search, 'i');
      filter.$or = [
        { 'customer.name': reg },
        { 'customer.email': reg },
        { 'customer.phone.number': reg },
        { 'customer.phone.countryCode': reg },
        { 'requirements.comments': reg },
        { 'requirements.stoneType': reg },
        { 'requirements.metalType': reg },
      ];
    }

    const [items, total] = await Promise.all([
      CustomInquiry.find(filter)
        .sort({ 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CustomInquiry.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get custom inquiry lookup ----------------------------

  async getLookup(queryParams = {}) {
    const filter = { 'meta.deletedAt': null };
    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    return await CustomInquiry.find(filter)
      .sort({ 'meta.createdAt': -1 })
      .select('_id customer requirements referenceImages status meta')
      .lean();
  }

  // ------------------------------- update custom inquiry ----------------------------

  async update(id, data) {
    const item = await CustomInquiry.findOneAndUpdate(
      { _id: id },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Custom inquiry not found');
    }

    return item;
  }

  // ------------------------------- delete custom inquiry ----------------------------

  async delete(id) {
    const item = await CustomInquiry.findOneAndUpdate(
      { _id: id },
      { $set: { 'meta.deletedAt': new Date() } },
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'Custom inquiry not found');
    }

    return { message: 'Custom inquiry deleted successfully', id };
  }

  // ------------------------------- bulk delete custom inquiries ----------------------------
  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, 'Please provide an array of inquiry IDs to delete');
    }

    const result = await CustomInquiry.updateMany(
      { _id: { $in: ids } },
      { $set: { 'meta.deletedAt': new Date() } }
    );

    return {
      message: `${result.modifiedCount} custom inquiry(ies) deleted successfully`,
      deletedCount: result.modifiedCount,
      ids,
    };
  }
}

module.exports = new CustomInquiryService();
