const Birthstone = require('./birthstone.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class BirthstoneService {
  /**
   * Create new birthstone
   */
  // ------------------------------- create birthstone ----------------------------
  async create(data) {
    const existing = await Birthstone.findOne({ month: data.month, isDeleted: false });
    if (existing) {
      throw new ApiError(409, `A birthstone for ${data.month} already exists`);
    }
    return await Birthstone.create(data);
  }

  /**
   * Get single birthstone by ID
   */
  // ------------------------------- get one birthstone ----------------------------
  async getOne(id) {
    const item = await Birthstone.findOne({ _id: id, isDeleted: false });
    if (!item) {
      throw new ApiError(404, 'Birthstone not found');
    }
    return item;
  }

  /**
   * Get birthstone by Month name
   */
  // ------------------------------- get birthstone by month ----------------------------
  async getByMonth(month) {
    const item = await Birthstone.findOne({
      month: new RegExp(`^${month}$`, 'i'),
      isDeleted: false,
    });
    if (!item) {
      throw new ApiError(404, `Birthstone for month "${month}" not found`);
    }
    return item;
  }

  /**
   * Get all birthstones with filtering and pagination
   */
  // ------------------------------- get all birthstones ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { isDeleted: false };

    if (queryParams.month) {
      filter.month = new RegExp(queryParams.month, 'i');
    }
    if (queryParams.status) {
      filter.status = queryParams.status;
    }
    if (queryParams.search) {
      const searchRegex = new RegExp(queryParams.search, 'i');
      filter.$or = [{ month: searchRegex }, { stoneName: searchRegex }];
    }

    const [items, total] = await Promise.all([
      Birthstone.find(filter)
        .sort({ 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Birthstone.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  /**
   * Dropdown lookup API for Birthstones
   */
  // ------------------------------- get birthstone lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { isDeleted: false, status: 'active' };

    return await Birthstone.find(filter)
      .select('_id month stoneName image color')
      .lean();
  }

  /**
   * Update birthstone
   */
  // ------------------------------- update birthstone ----------------------------
  async update(id, data) {
    if (data.month) {
      const duplicate = await Birthstone.findOne({
        month: data.month,
        _id: { $ne: id },
        isDeleted: false,
      });
      if (duplicate) {
        throw new ApiError(409, `A birthstone for ${data.month} already exists`);
      }
    }

    const item = await Birthstone.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Birthstone not found');
    }

    return item;
  }

  /**
   * Soft delete birthstone
   */
  // ------------------------------- delete birthstone ----------------------------
  async delete(id) {
    const item = await Birthstone.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, status: 'inactive' } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'Birthstone not found');
    }

    return { message: 'Birthstone deleted successfully', id };
  }
}

module.exports = new BirthstoneService();
