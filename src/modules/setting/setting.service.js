const Setting = require('./setting.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const footerSettingsService = require('../footerSettings/footerSettings.service');
const topAnnouncementService = require('../topAnnouncement/topAnnouncement.service');

class SettingService {
  // ------------------------------- get settings ----------------------------
  async getSettings() {
    let setting = await Setting.findOne({ 'meta.deletedAt': null })
      .populate('currentThemeId', 'name code status description')
      .lean();

    if (!setting) return {};

    // If currentThemeId is not set, initialize it with active theme from website themes
    if (!setting.currentThemeId) {
      try {
        const { WebsiteTheme, WebsiteThemeSettings } = require('../websiteTheme/websiteTheme.model');
        const themeSettings = await WebsiteThemeSettings.findOne({ key: 'storefront' }).lean();
        const activeTheme = themeSettings?.activeThemeId
          ? await WebsiteTheme.findOne({ _id: themeSettings.activeThemeId }).select('name code status description').lean()
          : await WebsiteTheme.findOne({ status: 'active', 'meta.deletedAt': null }).select('name code status description').lean();

        if (activeTheme) {
          setting.currentThemeId = activeTheme;
          await Setting.updateOne({ _id: setting._id }, { $set: { currentThemeId: activeTheme._id } });
        }
      } catch (_) {}
    }

    return setting;
  }

  // ------------------------------- get common layout settings ----------------------------
  async getCommonSettings() {
    const [settingsRes, footerRes, announcementRes] = await Promise.allSettled([
      this.getSettings(),
      footerSettingsService.getSettings(),
      topAnnouncementService.getPublic(),
    ]);

    return {
      settings: settingsRes.status === 'fulfilled' ? settingsRes.value : {},
      footerSettings: footerRes.status === 'fulfilled' ? footerRes.value : {},
      topAnnouncement: announcementRes.status === 'fulfilled' ? announcementRes.value : { isEnabled: false, items: [] },
    };
  }

  // ------------------------------- update settings ----------------------------
  async updateSettings(data) {
    let settings = await Setting.findOne({ 'meta.deletedAt': null });
    if (!settings) {
      settings = await Setting.create(data);
    } else {
      if (data.socialMedia) {
        settings.socialMedia = {
          ...(settings.socialMedia?.toObject ? settings.socialMedia.toObject() : (settings.socialMedia || {})),
          ...data.socialMedia,
        };
        settings.markModified('socialMedia');
      }
      if (data.socialProof) {
        settings.socialProof = {
          ...(settings.socialProof?.toObject ? settings.socialProof.toObject() : (settings.socialProof || {})),
          ...data.socialProof,
        };
        settings.markModified('socialProof');
      }
      if (data.businessDetails) {
        settings.businessDetails = {
          ...(settings.businessDetails?.toObject ? settings.businessDetails.toObject() : (settings.businessDetails || {})),
          ...data.businessDetails,
        };
        settings.markModified('businessDetails');
      } else if (
        data.companyName !== undefined ||
        data.emailAddress !== undefined ||
        data.mobileNumber !== undefined ||
        data.storeAddress !== undefined ||
        data.gstCode !== undefined ||
        data.panCode !== undefined
      ) {
        settings.businessDetails = {
          ...(settings.businessDetails?.toObject ? settings.businessDetails.toObject() : (settings.businessDetails || {})),
          ...(data.companyName !== undefined ? { companyName: data.companyName } : {}),
          ...(data.emailAddress !== undefined ? { emailAddress: data.emailAddress } : {}),
          ...(data.mobileNumber !== undefined ? { mobileNumber: data.mobileNumber } : {}),
          ...(data.storeAddress !== undefined ? { storeAddress: data.storeAddress } : {}),
          ...(data.gstCode !== undefined ? { gstCode: data.gstCode } : {}),
          ...(data.panCode !== undefined ? { panCode: data.panCode } : {}),
        };
        settings.markModified('businessDetails');
      }

      if (data.themeColors) {
        settings.themeColors = {
          ...(settings.themeColors?.toObject ? settings.themeColors.toObject() : (settings.themeColors || {})),
          ...data.themeColors,
        };
        settings.markModified('themeColors');
      } else if (data.buttonColor || data.buttonHoverColor || data.buttonTextColor) {
        settings.themeColors = {
          ...(settings.themeColors?.toObject ? settings.themeColors.toObject() : (settings.themeColors || {})),
          ...(data.buttonColor ? { buttonColor: data.buttonColor } : {}),
          ...(data.buttonHoverColor ? { buttonHoverColor: data.buttonHoverColor } : {}),
          ...(data.buttonTextColor ? { buttonTextColor: data.buttonTextColor } : {}),
        };
        settings.markModified('themeColors');
      }

      if (data.bankDetails) {
        settings.bankDetails = {
          ...(settings.bankDetails?.toObject ? settings.bankDetails.toObject() : (settings.bankDetails || {})),
          ...data.bankDetails,
        };
        settings.markModified('bankDetails');
      } else if (data.bankName !== undefined || data.bankAccountNumber !== undefined || data.ifscCode !== undefined) {
        settings.bankDetails = {
          ...(settings.bankDetails?.toObject ? settings.bankDetails.toObject() : (settings.bankDetails || {})),
          ...(data.bankName !== undefined ? { bankName: data.bankName } : {}),
          ...(data.bankAccountNumber !== undefined ? { bankAccountNumber: data.bankAccountNumber } : {}),
          ...(data.ifscCode !== undefined ? { ifscCode: data.ifscCode } : {}),
        };
        settings.markModified('bankDetails');
      }

      Object.assign(settings, data);
      await settings.save();
    }

    // If currentThemeId was updated, sync it with WebsiteThemeSettings and activate the theme
    if (data.currentThemeId) {
      try {
        const { WebsiteTheme, WebsiteThemeSettings } = require('../websiteTheme/websiteTheme.model');
        await WebsiteThemeSettings.findOneAndUpdate(
          { key: 'storefront' },
          { $set: { activeThemeId: data.currentThemeId }, $inc: { revision: 1 } },
          { upsert: true }
        );
        // Set selected theme to active and other themes to draft
        await WebsiteTheme.updateMany(
          { _id: { $ne: data.currentThemeId }, status: 'active' },
          { $set: { status: 'draft' } }
        );
        await WebsiteTheme.updateOne(
          { _id: data.currentThemeId },
          { $set: { status: 'active' } }
        );
      } catch (err) {
        console.error('Failed to sync theme in settings update:', err);
      }
    }

    if (data.buttonColor) {
      try {
        const { WebsiteTheme } = require('../websiteTheme/websiteTheme.model');
        const themeId = data.currentThemeId || settings.currentThemeId;
        if (themeId) {
          await WebsiteTheme.updateOne(
            { _id: themeId },
            { $set: { 'config.colors.primary': data.buttonColor } }
          );
        }
      } catch (err) {
        console.error('Failed to sync button color to theme:', err);
      }
    }

    const updated = await Setting.findById(settings._id)
      .populate('currentThemeId', 'name code status description')
      .lean();

    return updated;
  }

  // ------------------------------- create setting ----------------------------
  async create(data) {
    return await Setting.create(data);
  }

  // ------------------------------- get one setting ----------------------------
  async getOne(id) {
    const item = await Setting.findOne({ _id: id });
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
    const filter = { 'meta.deletedAt': null };
    return await Setting.find(filter)
      .select('_id businessDetails')
      .lean();
  }

  // ------------------------------- update setting ----------------------------
  async update(id, data) {
    const item = await Setting.findOneAndUpdate(
      { _id: id },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Setting not found');
    }

    return item;
  }

  // ------------------------------- delete setting ----------------------------
  async delete(id) {
    const item = await Setting.findOneAndUpdate(
      { _id: id },
      { $set: { 'meta.deletedAt': new Date() } },
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'Setting not found');
    }

    return { message: 'Setting deleted successfully', id };
  }
}

module.exports = new SettingService();
