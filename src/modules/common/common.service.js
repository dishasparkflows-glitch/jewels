const settingService = require('../setting/setting.service');
const categoryService = require('../category/category.service');
const themeService = require('../theme/theme.service');
const Setting = require('../setting/setting.model');

class CommonService {
  /**
   * Helper to increment the global storefront revision whenever
   * settings, navigation, categories, banners, or themes change.
   */
  async bumpRevision() {
    try {
      const setting = await Setting.findOneAndUpdate(
        { 'meta.deletedAt': null },
        { $inc: { revision: 1 } },
        { new: true }
      );
      return setting?.revision || 1;
    } catch (_) {
      return 1;
    }
  }

  /**
   * Returns current master revision number for lightweight freshness checks.
   */
  async getRevision() {
    try {
      const setting = await Setting.findOne({ 'meta.deletedAt': null }).select('revision updatedAt').lean();
      return {
        revision: setting?.revision || 0,
        updatedAt: setting?.updatedAt || new Date().toISOString(),
      };
    } catch (_) {
      return {
        revision: 0,
        updatedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Aggregates all storefront initialization data into a single fast payload.
   * Runs queries in parallel.
   */
  async getBootstrapData() {
    const [commonRes, navRes, configRes] = await Promise.allSettled([
      settingService.getCommonSettings(),
      categoryService.getNavigation(),
      themeService.getPublicConfig(),
    ]);

    const common = commonRes.status === 'fulfilled' ? commonRes.value : {};
    const navigation = navRes.status === 'fulfilled' ? (navRes.value || []) : [];
    const websiteConfig = configRes.status === 'fulfilled' ? configRes.value : null;

    const revisionDoc = await this.getRevision();
    const masterRevision = Math.max(revisionDoc.revision || 0, websiteConfig?.revision || 0);

    const currencyShowOnStorefront =
      (common.settings?.currency?.showOnStorefront ?? common.currency?.showOnStorefront) !== false;

    const mergedSettings = {
      ...(common.settings || {}),
      birthstones: {
        showOnStorefront: Boolean(common.settings?.birthstones?.showOnStorefront ?? common.birthstones?.showOnStorefront),
      },
      currency: {
        showOnStorefront: currencyShowOnStorefront,
      },
    };

    return {
      revision: masterRevision,
      settings: mergedSettings,
      birthstones: mergedSettings.birthstones,
      currency: mergedSettings.currency,
      footerSettings: common.footerSettings || {},
      topAnnouncement: common.topAnnouncement || { isEnabled: false, items: [] },
      navigation,
      websiteConfig,
    };
  }
}

module.exports = new CommonService();
