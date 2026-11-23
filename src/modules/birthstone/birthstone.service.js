const Birthstone = require('./birthstone.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

const MONTH_DEFAULT_ORDER = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

class BirthstoneService {
  // ------------------------------- create birthstone ----------------------------
  async create(data) {
    const existing = await Birthstone.findOne({ month: data.month });
    if (existing) {
      throw new ApiError(409, `A birthstone for ${data.month} already exists`);
    }
    if (data.order === undefined || data.order === null || isNaN(Number(data.order))) {
      data.order = MONTH_DEFAULT_ORDER[String(data.month).toLowerCase()] || 0;
    } else {
      data.order = Number(data.order);
    }
    return await Birthstone.create(data);
  }

  // ------------------------------- get one birthstone ----------------------------
  async getOne(id) {
    const item = await Birthstone.findOne({ _id: id });
    if (!item) {
      throw new ApiError(404, 'Birthstone not found');
    }
    return item;
  }

  // ------------------------------- get birthstone by month ----------------------------
  async getByMonth(month) {
    const item = await Birthstone.findOne({
      month: new RegExp(`^${month}$`, 'i'),
    });
    if (!item) {
      throw new ApiError(404, `Birthstone for month "${month}" not found`);
    }
    return item;
  }

  // ------------------------------- get all birthstones ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

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

    const sort = queryParams.sortBy
      ? { [queryParams.sortBy]: queryParams.sortOrder === 'desc' ? -1 : 1 }
      : { order: 1, 'meta.createdAt': -1 };

    const [items, total] = await Promise.all([
      Birthstone.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Birthstone.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get birthstone lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { 'meta.deletedAt': null, status: 'active' };

    return await Birthstone.find(filter)
      .select('_id month stoneName image order')
      .sort({ order: 1 })
      .lean();
  }

  // ------------------------------- update birthstone ----------------------------
  async update(id, data) {
    if (data.month) {
      const duplicate = await Birthstone.findOne({
        month: data.month,
        _id: { $ne: id },
      });
      if (duplicate) {
        throw new ApiError(409, `A birthstone for ${data.month} already exists`);
      }
    }

    if (data.order !== undefined && data.order !== null) {
      data.order = Number(data.order);
    }

    const item = await Birthstone.findOneAndUpdate(
      { _id: id },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Birthstone not found');
    }

    return item;
  }

  // ------------------------------- delete birthstone ----------------------------
  async delete(id) {
    const item = await Birthstone.findOneAndUpdate(
      { _id: id },
      { $set: { status: 'inactive', 'meta.deletedAt': new Date() } },
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'Birthstone not found');
    }

    return { message: 'Birthstone deleted successfully', id };
  }
}

module.exports = new BirthstoneService();
