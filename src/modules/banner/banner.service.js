const Banner = require('./banner.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class BannerService {
  // ------------------------------- create banner ----------------------------
  async create(data) {
    return await Banner.create(data);
  }

  // ------------------------------- get one banner ----------------------------
  async getOne(id) {
    const banner = await Banner.findOne({ _id: id, isDeleted: false }).populate('category', 'name slug');
    if (!banner) {
      throw new ApiError(404, 'Banner not found');
    }
    return banner;
  }

  // ------------------------------- get all banners ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { isDeleted: false };

    if (queryParams.type) {
      filter.type = queryParams.type;
    }
    if (queryParams.status) {
      filter.status = queryParams.status;
    }
    if (queryParams.category) {
      filter.category = queryParams.category;
    }
    if (queryParams.position && queryParams.position !== 'all') {
      filter.position = queryParams.position;
    }
    if (queryParams.search) {
      filter.$or = [
        { title: new RegExp(queryParams.search, 'i') },
        { position: new RegExp(queryParams.search, 'i') },
      ];
    }

    const [items, total] = await Promise.all([
      Banner.find(filter)
        .populate('category', 'name slug')
        .sort({ order: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Banner.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get banner lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { isDeleted: false, status: 'active' };

    if (queryParams.type) {
      filter.type = queryParams.type;
    }

    return await Banner.find(filter)
      .select('_id title type position image mediaType')
      .lean();
  }

  // ------------------------------- update banner ----------------------------
  async update(id, data) {
    const banner = await Banner.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!banner) {
      throw new ApiError(404, 'Banner not found');
    }

    return banner;
  }

  // ------------------------------- delete banner ----------------------------
  async delete(id) {
    const banner = await Banner.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, status: 'inactive' } },
      { new: true }
    );

    if (!banner) {
      throw new ApiError(404, 'Banner not found');
    }

    return { message: 'Banner deleted successfully', id };
  }
}

module.exports = new BannerService();
