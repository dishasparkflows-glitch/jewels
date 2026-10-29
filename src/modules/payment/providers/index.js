const razorpayService = require('./razorpay.service');
const ccavenueService = require('./ccavenue.service');
const ApiError = require('../../../utils/ApiError');

/**
 * Registry of available payment providers.
 * To add a new provider in the future (e.g. PhonePe, Stripe, PayU):
 * 1. Create `providers/phonepe.service.js` extending BasePaymentProvider.
 * 2. Register it here in the `providers` map.
 */
const providers = {
  [razorpayService.name]: razorpayService,
  [ccavenueService.name]: ccavenueService,
};

const getProvider = (name) => {
  if (!name) {
    const defaultName = (process.env.DEFAULT_PAYMENT_GATEWAY || 'razorpay').toLowerCase();
    return providers[defaultName] || razorpayService;
  }

  const key = String(name).toLowerCase().trim();
  const provider = providers[key];
  if (!provider) {
    throw new ApiError(400, `Unsupported payment provider: "${name}". Available providers: ${Object.keys(providers).join(', ')}`);
  }
  return provider;
};

const getAllProviders = () => Object.values(providers);

const getActiveProviders = () => Object.values(providers).filter((p) => p.isConfigured());

const registerProvider = (providerInstance) => {
  if (!providerInstance || !providerInstance.name) {
    throw new Error('Invalid provider instance: name is required');
  }
  providers[providerInstance.name.toLowerCase()] = providerInstance;
};

module.exports = {
  getProvider,
  getAllProviders,
  getActiveProviders,
  registerProvider,
  providers,
};
