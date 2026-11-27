const Review = require('./review.model');
const { escapeRegex } = require('../../utils/string');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class ReviewService {
  // ------------------------------- create review ----------------------------
  async create(data) {
    if (!data.productId || data.productId === 'null' || data.productId === '') {
      data.productId = null;
    }
    return await Review.create(data);
  }

  // ------------------------------- get one review ----------------------------
  async getOne(id) {
    const item = await Review.findOne({ _id: id, 'meta.deletedAt': null })
      .populate('productId', 'basicInfo.title basicInfo.slug basicInfo.sku media.images ornate.ornateImages');
    if (!item) {
      throw new ApiError(404, 'Review not found');
    }
    return item;
  }

  // ------------------------------- get all reviews ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    if (queryParams.productId) {
      filter.productId = queryParams.productId;
    }

    if (queryParams.search) {
      const reg = new RegExp(escapeRegex(queryParams.search.trim()), 'i');
      filter.$or = [
        { 'customer.name': reg },
        { 'customer.email': reg },
        { 'review.title': reg },
        { 'review.comment': reg },
      ];
    }

    const selectFields = queryParams.status === 'approved' ? '-meta' : '';

    const query = Review.find(filter)
      .populate('productId', 'basicInfo.title basicInfo.slug basicInfo.sku media.images ornate.ornateImages')
      .sort({ 'review.reviewDate': -1, 'meta.createdAt': -1 })
      .skip(skip)
      .limit(limit);

    if (selectFields) query.select(selectFields);

    const [items, total] = await Promise.all([
      query.lean(),
      Review.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get review lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { 'meta.deletedAt': null, status: 'approved' };
    if (queryParams.productId) {
      filter.productId = queryParams.productId;
    }
    return await Review.find(filter)
      .populate('productId', 'basicInfo.title basicInfo.slug basicInfo.sku media.images ornate.ornateImages')
      .sort({ 'review.reviewDate': -1 })
      .select('-meta')
      .lean();
  }

  // ------------------------------- update review ----------------------------
  async update(id, data) {
    if (data.productId !== undefined) {
      if (!data.productId || data.productId === 'null' || data.productId === '') {
        data.productId = null;
      }
    }

    const item = await Review.findOneAndUpdate(
      { _id: id, 'meta.deletedAt': null },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    ).populate('productId', 'basicInfo.title basicInfo.slug basicInfo.sku media.images ornate.ornateImages');

    if (!item) {
      throw new ApiError(404, 'Review not found');
    }

    return item;
  }

  // ------------------------------- bulk delete reviews ----------------------------
  async bulkDelete(ids = []) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, 'ids array is required for bulk delete');
    }
    const result = await Review.updateMany(
      { _id: { $in: ids }, 'meta.deletedAt': null },
      { $set: { 'meta.deletedAt': new Date() } }
    );
    return {
      message: `${result.modifiedCount || 0} review(s) deleted successfully`,
      deletedCount: result.modifiedCount || 0,
      ids,
    };
  }

  // ------------------------------- delete review ----------------------------
  async delete(id) {
    const item = await Review.findOneAndUpdate(
      { _id: id, 'meta.deletedAt': null },
      { $set: { 'meta.deletedAt': new Date() } },
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'Review not found');
    }

    return { message: 'Review deleted successfully', id };
  }
}

module.exports = new ReviewService();
