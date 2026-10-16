const VTOMaster = require('./vtoMaster.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class VTOMasterService {
  // ------------------------------- create vto master ----------------------------
  async create(data) {
    if (data.bodyPart) {
      data.bodyPart = data.bodyPart.toLowerCase().trim();
      const existing = await VTOMaster.findOne({
        bodyPart: data.bodyPart,
        'meta.deletedAt': null,
      });
      if (existing) {
        throw new ApiError(
          409,
          `VTO configuration for body part "${data.bodyPart}" already exists`
        );
      }
    }
    return await VTOMaster.create(data);
  }

  // ------------------------------- get one vto master ----------------------------
  async getOne(id) {
    const item = await VTOMaster.findOne({ _id: id, 'meta.deletedAt': null }).lean();
    if (!item) {
      throw new ApiError(404, 'VTO configuration not found');
    }
    return item;
  }

  // ------------------------------- get vto master by body part ----------------------------
  async getByBodyPart(bodyPart) {
    const item = await VTOMaster.findOne({
      bodyPart: bodyPart.toLowerCase().trim(),
      'meta.deletedAt': null,
    }).lean();
    if (!item) {
      throw new ApiError(404, `VTO configuration for "${bodyPart}" not found`);
    }
    return item;
  }

  // ------------------------------- get all vto masters ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    if (queryParams.bodyPart) {
      filter.bodyPart = queryParams.bodyPart.toLowerCase();
    }
    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    const [items, total] = await Promise.all([
      VTOMaster.find(filter)
        .sort({ 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      VTOMaster.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get vto master lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { 'meta.deletedAt': null, status: 'active' };
    const items = await VTOMaster.find(filter)
      .sort({ 'meta.createdAt': -1 })
      .select('_id bodyPart lightImage darkImage status')
      .lean();
    return items;
  }

  // ------------------------------- update vto master ----------------------------
  async update(id, data) {
    if (data.bodyPart) {
      data.bodyPart = data.bodyPart.toLowerCase().trim();
      const existing = await VTOMaster.findOne({
        bodyPart: data.bodyPart,
        _id: { $ne: id },
        'meta.deletedAt': null,
      });
      if (existing) {
        throw new ApiError(
          409,
          `VTO configuration for body part "${data.bodyPart}" already exists`
        );
      }
    }

    const item = await VTOMaster.findOneAndUpdate(
      { _id: id },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'VTO configuration not found');
    }

    return item;
  }

  // ------------------------------- delete vto master ----------------------------
  async delete(id) {
    const item = await VTOMaster.findOneAndUpdate(
      { _id: id },
      { $set: { status: 'inactive', 'meta.deletedAt': new Date() } },
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'VTO configuration not found');
    }

    return { message: 'VTO configuration deleted successfully', id };
  }
}

module.exports = new VTOMasterService();
