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
    const item = await Review.findOne({ _id: id, isDeleted: false });
    if (!item) {
      throw new ApiError(404, 'Review not found');
    }
    return item;
  }

  // ------------------------------- get all reviews ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { isDeleted: false };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }
    if (queryParams.search) {
      filter.$or = [
        { clientName: new RegExp(queryParams.search, 'i') },
        { comment: new RegExp(queryParams.search, 'i') },
      ];
    }

    const [items, total] = await Promise.all([
      Review.find(filter)
        .sort({ reviewDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get review lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { isDeleted: false, status: 'approved' };
    return await Review.find(filter)
      .sort({ reviewDate: -1 })
      .select('_id clientName rating comment reviewDate')
      .lean();
  }

  // ------------------------------- update review ----------------------------
  async update(id, data) {
    const item = await Review.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Review not found');
    }

    return item;
  }

  // ------------------------------- delete review ----------------------------
  async delete(id) {
    const item = await Review.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'Review not found');
    }

    return { message: 'Review deleted successfully', id };
  }
}

module.exports = new ReviewService();
