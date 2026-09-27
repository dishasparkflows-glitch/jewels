const Setting = require('./setting.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class SettingService {
  // ------------------------------- get settings ----------------------------
  async getSettings() {
    let settings = await Setting.findOne({ isDeleted: false }).lean();
    if (!settings) {
      settings = await Setting.create({
        companyName: 'Neirah',
        emailAddress: 'info@neirah.in',
        mobileNumber: '+91 84600-91955',
        storeAddress:
          'Sanskrut - 1 GH Road G-1. 1/2 Sector 3D plot no.1182 G-1, near Hi-Tech hospital, Gandhinagar',
        gstCode: '24AAAAA0000A1Z5',
        panCode: 'ABCDE1234F',
        returnPeriodDays: 10,
        returnPolicy: 'Easy 15-Day Returns & Refund',
        shippingPolicy: '',
        bankName: 'HDFC BANK',
        bankAccountNumber: '50200012345678',
        ifscCode: 'HDFC0000451',
      });
    }
    return settings;
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
    const filter = { isDeleted: false };

    const [items, total] = await Promise.all([
      Setting.find(filter)
        .sort({ createdAt: -1 })
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
