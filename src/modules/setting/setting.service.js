const Setting = require('./setting.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class SettingService {
  // ------------------------------- get settings ----------------------------
  async getSettings() {
    return (await Setting.findOne({ isDeleted: false }).lean()) || {};
  }

  // ------------------------------- update settings ----------------------------
  async updateSettings(data) {
    let settings = await Setting.findOne({ isDeleted: false });
    if (!settings) {
      return await Setting.create(data);
    }

    Object.assign(settings, data);
    await settings.save();
    return settings;
  }

  // ------------------------------- create setting ----------------------------
  async create(data) {
    return await Setting.create(data);
  }

  // ------------------------------- get one setting ----------------------------
  async getOne(id) {
    const item = await Setting.findOne({ _id: id, isDeleted: false });
    if (!item) {
      throw new ApiError(404, 'Setting not found');
    }
    return item;
  }

  // ------------------------------- get all settings ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    const [items, total] = await Promise.all([
      Setting.find(filter)
        .sort({ 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Setting.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get setting lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { isDeleted: false };
    return await Setting.find(filter)
      .select('_id companyName emailAddress mobileNumber')
      .lean();
  }

  // ------------------------------- update setting ----------------------------
  async update(id, data) {
    const item = await Setting.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Setting not found');
    }

    return item;
  }

  // ------------------------------- delete setting ----------------------------
  async delete(id) {
    const item = await Setting.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'Setting not found');
    }

    return { message: 'Setting deleted successfully', id };
  }
}

module.exports = new SettingService();
