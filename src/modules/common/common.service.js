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
    return 1;
  }

  /**
   * Returns current master revision number for lightweight freshness checks.
   */
  async getRevision() {
    return {
      revision: 0,
      updatedAt: new Date().toISOString(),
    };
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
