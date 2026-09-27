const InstagramPost = require('./instagramPost.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class InstagramPostService {
  // ------------------------------- create instagram post ----------------------------
  async create(data) {
    return await InstagramPost.create(data);
  }

  // ------------------------------- get one instagram post ----------------------------
  async getOne(id) {
    const item = await InstagramPost.findOne({ _id: id, isDeleted: false });
    if (!item) {
      throw new ApiError(404, 'Instagram post not found');
    }
    return item;
  }

  // ------------------------------- get all instagram posts ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { isDeleted: false };

    if (queryParams.isActive !== undefined) {
      filter.isActive = queryParams.isActive === 'true' || queryParams.isActive === true;
    }

    if (queryParams.position) {
      filter.position = queryParams.position;
    }

    const [items, total] = await Promise.all([
      InstagramPost.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      InstagramPost.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get instagram post lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { isDeleted: false, isActive: true };
    return await InstagramPost.find(filter)
      .sort({ createdAt: -1 })
      .select('_id url position isActive')
      .lean();
  }

  // ------------------------------- update instagram post ----------------------------
  async update(id, data) {
    const item = await InstagramPost.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Instagram post not found');
    }

    return item;
  }

  // ------------------------------- delete instagram post ----------------------------
  async delete(id) {
    const item = await InstagramPost.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, isActive: false } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'Instagram post not found');
    }

    return { message: 'Instagram post deleted successfully', id };
  }
}

module.exports = new InstagramPostService();
