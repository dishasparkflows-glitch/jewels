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

    if (queryParams.isActive !== undefined && queryParams.isActive !== '' && queryParams.isActive !== 'all') {
      filter.isActive = queryParams.isActive === 'true' || queryParams.isActive === true;
    }

    if (queryParams.search) {
      const q = queryParams.search.trim();
      const orConditions = [
        { url: new RegExp(q, 'i') },
        { title: new RegExp(q, 'i') },
      ];
      if (/^[0-9a-fA-F]{24}$/.test(q)) {
        orConditions.push({ _id: q });
      }
      filter.$or = orConditions;
    }

    const [items, total] = await Promise.all([
      InstagramPost.find(filter)
        .sort({ order: 1, 'meta.createdAt': -1 })
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
      .sort({ 'meta.createdAt': -1 })
      .select('_id url order isActive')
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

  // ------------------------------- reorder instagram posts ----------------------------
  async reorder(items) {
    if (Array.isArray(items)) {
      const bulkOps = items.map((it, idx) => ({
        updateOne: {
          filter: { _id: it.id || it._id },
          update: {
            $set: {
              order: typeof it.order === 'number' ? it.order : idx + 1,
            },
          },
        },
      }));
      if (bulkOps.length > 0) {
        await InstagramPost.bulkWrite(bulkOps);
      }
    }
    return { success: true };
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

  // ------------------------------- bulk delete instagram posts ----------------------------
  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, 'Please provide an array of post IDs to delete');
    }

    const result = await InstagramPost.updateMany(
      { _id: { $in: ids }, isDeleted: false },
      { $set: { isDeleted: true, isActive: false } }
    );

    return {
      message: `${result.modifiedCount} post(s) deleted successfully`,
      deletedCount: result.modifiedCount,
      ids,
    };
  }
}

module.exports = new InstagramPostService();
