const Setting = require('./setting.model');
const ApiError = require('../../utils/ApiError');
const topAnnouncementService = require('../topAnnouncement/topAnnouncement.service');

const normalizeFooterLinksColumn = (links = [], { activeOnly = false } = {}) =>
  (Array.isArray(links) ? links : [])
    .filter((item) => {
      if (!item || !String(item.name || '').trim() || !String(item.path || '').trim()) {
        return false;
      }
      return activeOnly ? item.status !== 'inactive' : true;
    })
    .map((item) => ({
      name: String(item.name).trim(),
      path: String(item.path).trim(),
      status: item.status === 'inactive' ? 'inactive' : 'active',
    }));

const normalizeFooterLinksPayload = (footerLinks = {}, options = {}) => {
  const result = {};
  if (footerLinks.brand !== undefined || options.includeEmptyColumns) {
    result.brand = normalizeFooterLinksColumn(footerLinks.brand, options);
  }
  if (footerLinks.policies !== undefined || options.includeEmptyColumns) {
    result.policies = normalizeFooterLinksColumn(footerLinks.policies, options);
  }
  return result;
};

class SettingService {
  // ------------------------------- get settings ----------------------------
  async getSettings() {
    let setting = await Setting.findOne({ 'meta.deletedAt': null })
      .populate('currentThemeId', 'name code status description')
      .lean();

    if (!setting) return {};

    // If currentThemeId is not set, initialize it with first available theme
    if (!setting.currentThemeId) {
      try {
        const { Theme } = require('../theme/theme.model');
        const defaultTheme = await Theme.findOne({ 'meta.deletedAt': null }).select('name code description').lean();
        if (defaultTheme) {
          setting.currentThemeId = defaultTheme;
          await Setting.updateOne({ _id: setting._id }, { $set: { currentThemeId: defaultTheme._id } });
        }
      } catch (_) { }
    }

    return setting;
  }

  // ------------------------------- get common layout settings ----------------------------
  async getCommonSettings() {
    const [settingsRes, announcementRes] = await Promise.allSettled([
      this.getSettings(),
      topAnnouncementService.getPublic(),
    ]);

    const settings = settingsRes.status === 'fulfilled' ? settingsRes.value : {};
    const publicFooterLinks = normalizeFooterLinksPayload(settings?.footerLinks || {}, {
      activeOnly: true,
      includeEmptyColumns: true,
    });

    return {
      settings,
      footerSettings: {
        footerLinks: publicFooterLinks,
      },
      topAnnouncement: announcementRes.status === 'fulfilled' ? announcementRes.value : { isEnabled: false, items: [] },
      birthstones: {
        showOnStorefront: settings?.birthstones?.showOnStorefront === true,
      },
      currency: {
        showOnStorefront: settings?.currency?.showOnStorefront !== false,
      },
    };
  }

  // ------------------------------- update settings ----------------------------
  async updateSettings(data) {
    if (data.footerLinks && typeof data.footerLinks === 'object') {
      data.footerLinks = normalizeFooterLinksPayload(data.footerLinks);
    }

    let settings = await Setting.findOne({ 'meta.deletedAt': null });
    if (!settings) {
      settings = await Setting.create({
        ...data,
        revision: 1,
      });
    } else {
      // Cleanly merge nested subdocuments without overwriting untouched sibling fields
      const subdocFields = [
        'socialMedia',
        'socialProof',
        'businessDetails',
        'themeColors',
        'bankDetails',
        'mediaCompression',
        'topAnnouncement',
        'birthstones',
        'currency',
        'otpSettings',
        'footerLinks',
      ];

      subdocFields.forEach((field) => {
        if (data[field]) {
          settings[field] = {
            ...(settings[field]?.toObject ? settings[field].toObject() : (settings[field] || {})),
            ...data[field],
          };
          settings.markModified(field);
          delete data[field];
        }
      });

      // Flat form field aliases for businessDetails
      if (
        data.companyName !== undefined ||
        data.emailAddress !== undefined ||
        data.mobileNumber !== undefined ||
        data.storeAddress !== undefined ||
        data.gstCode !== undefined ||
        data.panCode !== undefined ||
        data.playStoreUrl !== undefined ||
        data.appStoreUrl !== undefined ||
        data.manufacturer !== undefined ||
        data.countryOfOrigin !== undefined
      ) {
        settings.businessDetails = {
          ...(settings.businessDetails?.toObject ? settings.businessDetails.toObject() : (settings.businessDetails || {})),
          ...(data.companyName !== undefined ? { companyName: data.companyName } : {}),
          ...(data.emailAddress !== undefined ? { emailAddress: data.emailAddress } : {}),
          ...(data.mobileNumber !== undefined ? { mobileNumber: data.mobileNumber } : {}),
          ...(data.storeAddress !== undefined ? { storeAddress: data.storeAddress } : {}),
          ...(data.gstCode !== undefined ? { gstCode: data.gstCode } : {}),
          ...(data.panCode !== undefined ? { panCode: data.panCode } : {}),
          ...(data.playStoreUrl !== undefined ? { playStoreUrl: data.playStoreUrl } : {}),
          ...(data.appStoreUrl !== undefined ? { appStoreUrl: data.appStoreUrl } : {}),
          ...(data.manufacturer !== undefined ? { manufacturer: data.manufacturer } : {}),
          ...(data.countryOfOrigin !== undefined ? { countryOfOrigin: data.countryOfOrigin } : {}),
        };
        settings.markModified('businessDetails');
      }

      // Flat form field aliases for bankDetails
      if (data.bankName !== undefined || data.bankAccountNumber !== undefined || data.ifscCode !== undefined) {
        settings.bankDetails = {
          ...(settings.bankDetails?.toObject ? settings.bankDetails.toObject() : (settings.bankDetails || {})),
          ...(data.bankName !== undefined ? { bankName: data.bankName } : {}),
          ...(data.bankAccountNumber !== undefined ? { bankAccountNumber: data.bankAccountNumber } : {}),
          ...(data.ifscCode !== undefined ? { ifscCode: data.ifscCode } : {}),
        };
        settings.markModified('bankDetails');
      }

      // Top-level fields (logoImage, mobileLogoImage, certificateImage, loginModalImage, trustBadges, paymentProvider, currentThemeId)
      Object.assign(settings, data);
      settings.revision = (settings.revision || 0) + 1;
      await settings.save();
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
