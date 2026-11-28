const Setting = require('../modules/setting/setting.model');

const DEFAULT_BRAND_NAME = 'Jewels';

/**
 * Resolves configured storefront company name from settings with `'Jewels'` fallback.
 */
function getCompanyName(setting, fallback = DEFAULT_BRAND_NAME) {
  const raw = setting?.businessDetails?.companyName || '';
  const trimmed = String(raw).trim();
  return trimmed || fallback;
}

/**
 * Resolves uppercase alphanumeric brand prefix (e.g. for invoice filenames), defaulting to `'JEWELS'`.
 */
function getCompanyPrefix(setting) {
  const name = getCompanyName(setting, DEFAULT_BRAND_NAME);
  const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cleaned || DEFAULT_BRAND_NAME.toUpperCase();
}

/**
 * Fetches the active store setting document safely from MongoDB.
 */
async function getActiveStoreSetting() {
  try {
    return (await Setting.findOne({ 'meta.deletedAt': null }).select('businessDetails').lean()) || {};
  } catch (_) {
    return {};
  }
}

/**
 * Resolves active store company name from MongoDB settings with `'Jewels'` fallback.
 */
async function getActiveCompanyName(fallback = DEFAULT_BRAND_NAME) {
  const setting = await getActiveStoreSetting();
  return getCompanyName(setting, fallback);
}

module.exports = {
  DEFAULT_BRAND_NAME,
  getCompanyName,
  getCompanyPrefix,
  getActiveStoreSetting,
  getActiveCompanyName,
};
