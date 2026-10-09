const FooterSettings = require('./footerSettings.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class FooterSettingsService {
  // ------------------------------- get footer settings ----------------------------
  async getSettings() {
    let settings = await FooterSettings.findOne({ isDeleted: false }).lean();
    if (!settings) {
      settings = await FooterSettings.create({
        shopItems: [],
        socialLinks: [
          { platform: 'Instagram', url: 'https://instagram.com' },
          { platform: 'Facebook', url: 'https://facebook.com' },
          { platform: 'Pinterest', url: 'https://pinterest.com' },
        ],
        copyright: 'Neirah Jewellers Private Limited All Rights Reserved',
      });
    }
    return settings;
  }

  // ------------------------------- update footer settings ----------------------------
  async updateSettings(data) {
    let settings = await FooterSettings.findOne({ isDeleted: false });
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
    const item = await FooterSettings.findOne({ _id: id, isDeleted: false });
    if (!item) {
      throw new ApiError(404, 'Footer settings not found');
    }
    return item;
  }

  // ------------------------------- get all footer settings ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { isDeleted: false };

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
    const filter = { isDeleted: false };
    return await FooterSettings.find(filter)
      .select('_id socialLinks shopItems copyright')
      .lean();
  }

  // ------------------------------- update footer settings record ----------------------------
  async update(id, data) {
    const item = await FooterSettings.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Footer settings not found');
    }

    return item;
  }

  // ------------------------------- delete footer settings ----------------------------
  async delete(id) {
    const item = await FooterSettings.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'Footer settings not found');
    }

    return { message: 'Footer settings deleted successfully', id };
  }
}

module.exports = new FooterSettingsService();
