const FooterSettings = require('./footerSettings.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class FooterSettingsService {
  // ------------------------------- get footer settings ----------------------------
  async getSettings() {
    return (await FooterSettings.findOne({ 'meta.deletedAt': null }).lean()) || {};
  }

  // ------------------------------- update footer settings ----------------------------
  async updateSettings(data) {
    let settings = await FooterSettings.findOne({ 'meta.deletedAt': null });
    if (!settings) {
      return await FooterSettings.create(data);
    }

    Object.assign(settings, data);
    await settings.save();
    return settings;
  }

  // ------------------------------- create footer settings ----------------------------
  async create(data) {
    return await FooterSettings.create(data);
  }

  // ------------------------------- get one footer settings ----------------------------
  async getOne(id) {
    const item = await FooterSettings.findOne({ _id: id });
    if (!item) {
      throw new ApiError(404, 'Footer settings not found');
    }
    return item;
  }

  // ------------------------------- get all footer settings ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    const [items, total] = await Promise.all([
      FooterSettings.find(filter)
        .sort({ 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FooterSettings.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get footer settings lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { 'meta.deletedAt': null };
    return await FooterSettings.find(filter)
      .select('_id socialLinks shopItems copyright')
      .lean();
  }

  // ------------------------------- update footer settings record ----------------------------
  async update(id, data) {
    const item = await FooterSettings.findOneAndUpdate(
      { _id: id },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Footer settings not found');
    }

    return item;
  }

  // ------------------------------- delete footer settings ----------------------------
  async delete(id) {
    const item = await FooterSettings.findOneAndUpdate(
      { _id: id },
      { $set: { 'meta.deletedAt': new Date() } },
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'Footer settings not found');
    }

    return { message: 'Footer settings deleted successfully', id };
  }
}

module.exports = new FooterSettingsService();
