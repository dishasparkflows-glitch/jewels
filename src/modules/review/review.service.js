const Review = require('./review.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class ReviewService {
  // ------------------------------- create review ----------------------------
  async create(data) {
    return await Review.create(data);
  }

  // ------------------------------- get one review ----------------------------
  async getOne(id) {
    const item = await Review.findOne({ _id: id });
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
    if (queryParams.search) {
      const reg = new RegExp(queryParams.search, 'i');
      filter.$or = [
        { 'customer.name': reg },
        { 'customer.email': reg },
        { 'review.title': reg },
        { 'review.comment': reg },
      ];
    }

    const selectFields = queryParams.status === 'approved' ? '-meta' : '';

    const query = Review.find(filter)
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
    return await Review.find(filter)
      .sort({ 'review.reviewDate': -1 })
      .select('-meta')
      .lean();
  }

  // ------------------------------- update review ----------------------------
  async update(id, data) {
    const item = await Review.findOneAndUpdate(
      { _id: id },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Review not found');
    }

    return item;
  }

  // ------------------------------- delete review ----------------------------
  async delete(id) {
    const item = await Review.findOneAndUpdate(
      { _id: id },
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
