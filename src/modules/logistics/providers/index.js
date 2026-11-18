const shiprocketProvider = require('./shiprocket.provider');
const ApiError = require('../../../utils/ApiError');

/**
 * Registry of available logistics providers.
 * To integrate a new logistics service in the future (e.g. Delhivery, Blue Dart, DTDC, Manual):
 * 1. Create `providers/<name>.provider.js` extending BaseLogisticsProvider.
 * 2. Register it here in the `providers` map.
 * 3. Set `LOGISTICS_PROVIDER=<name>` in `.env`.
 */
const providers = {
  [shiprocketProvider.name]: shiprocketProvider,
};

// ------------------------------- get provider ----------------------------
const getProvider = (name) => {
  if (!name) {
    const defaultName = (
      process.env.LOGISTICS_PROVIDER ||
      process.env.SHIPPING_PROVIDER ||
      'shiprocket'
    ).toLowerCase().trim();
    return providers[defaultName] || shiprocketProvider;
  }

  const key = String(name).toLowerCase().trim();
  const provider = providers[key];
  if (!provider) {
    throw new ApiError(
      400,
      `Unsupported logistics provider: "${name}". Available providers: ${Object.keys(providers).join(', ')}`
    );
  }
  return provider;
};

// ------------------------------- get all providers ----------------------------
const getAllProviders = () => Object.values(providers);

// ------------------------------- get active providers ----------------------------
const getActiveProviders = () =>
  Object.values(providers).filter((p) => p.isConfigured());

// ------------------------------- register custom provider ----------------------------
const registerProvider = (providerInstance) => {
  if (!providerInstance || !providerInstance.name) {
    throw new Error('Invalid logistics provider instance: name is required');
  }
  providers[providerInstance.name.toLowerCase()] = providerInstance;
};

module.exports = {
  getProvider,
  getAllProviders,
  getActiveProviders,
  registerProvider,
};
