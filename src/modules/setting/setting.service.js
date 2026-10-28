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

    if (!setting.socialProof) {
      setting.socialProof = {
        showSoldCounter: true,
        soldTimeHours: 3,
        defaultSoldCount: 24,
        showReviews: true,
        defaultReviewCount: 13,
        defaultRating: 5,
      };
    }

    if (!setting.socialMedia) {
      setting.socialMedia = {
        instagram: 'https://www.instagram.com/neirah.officials?igsh=MWRrcDE3YnlhaTd6eg%3D%3D&utm_source=qr',
        facebook: 'https://www.facebook.com/share/1Cosh9cg8h/?mibextid=wwXIfr',
        youtube: '',
        pinterest: '',
        twitter: '',
        linkedin: '',
        whatsapp: '',
      };
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

    return await Setting.findById(settings._id)
      .populate('currentThemeId', 'name code status description')
      .lean();
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
      .select('_id companyName emailAddress mobileNumber')
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
