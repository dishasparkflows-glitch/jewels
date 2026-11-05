const settingService = require('../setting/setting.service');
const categoryService = require('../category/category.service');
const websiteThemeService = require('../websiteTheme/websiteTheme.service');
const { WebsiteThemeSettings } = require('../websiteTheme/websiteTheme.model');

class CommonService {
  /**
   * Helper to increment the global storefront revision whenever
   * settings, navigation, categories, banners, or themes change.
   */
  async bumpRevision() {
    try {
      const updated = await WebsiteThemeSettings.findOneAndUpdate(
        { key: 'storefront' },
        { $inc: { revision: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      return updated?.revision || 1;
    } catch (err) {
      console.warn('Failed to bump storefront revision:', err.message);
      return null;
    }
  }

  /**
   * Returns current master revision number for lightweight freshness checks.
   */
  async getRevision() {
    try {
      const doc = await WebsiteThemeSettings.findOne({ key: 'storefront' }).select('revision updatedAt').lean();
      return {
        revision: doc?.revision || 0,
        updatedAt: doc?.updatedAt || new Date().toISOString(),
      };
    } catch (_) {
      return { revision: 0, updatedAt: new Date().toISOString() };
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
      websiteThemeService.getPublicConfig(),
    ]);

    const common = commonRes.status === 'fulfilled' ? commonRes.value : {};
    const navigation = navRes.status === 'fulfilled' ? (navRes.value || []) : [];
    const websiteConfig = configRes.status === 'fulfilled' ? configRes.value : null;

    const revisionDoc = await this.getRevision();
    const masterRevision = Math.max(revisionDoc.revision || 0, websiteConfig?.revision || 0);

    return {
      revision: masterRevision,
      settings: common.settings || {},
      footerSettings: common.footerSettings || {},
      topAnnouncement: common.topAnnouncement || { isEnabled: false, items: [] },
      navigation,
      websiteConfig,
    };
  }
}

module.exports = new CommonService();
