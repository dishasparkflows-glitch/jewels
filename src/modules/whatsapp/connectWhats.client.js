const axios = require('axios');
const IntegrationToken = require('./integrationToken.model');
const { encryptToken, decryptToken } = require('../../utils/encryption');
const { normalizeUrl } = require('./whatsapp.utils');
const ApiError = require('../../utils/ApiError');

const PROVIDER = 'connectwhats';
const ACCOUNT_KEY = 'default';
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

class ConnectWhatsClient {
  /**
   * Loads configuration from environment variables
   */
  getEnvConfig() {
    const apiKey = (process.env.CONNECTWHATS_API_KEY || process.env.CONNECTWHATS_TOKEN || '').trim();
    const apiUrl = normalizeUrl(process.env.CONNECTWHATS_API_URL);
    const instanceId = (process.env.CONNECTWHATS_INSTANCE_ID || '').trim();
    const phoneNumber = (process.env.CONNECTWHATS_PHONE_NUMBER || '').trim();
    const phoneNumberId = (process.env.CONNECTWHATS_PHONE_NUMBER_ID || '').trim();
    const wabaId = (process.env.CONNECTWHATS_WABA_ID || '').trim();

    return {
      apiKey,
      apiUrl,
      instanceId,
      phoneNumber,
      phoneNumberId,
      wabaId,
      isConfigured: Boolean(apiKey),
    };
  }

  /**
   * Retrieves active credentials from DB (decrypted) or falls back to env
   */
  async getActiveCredentials() {
    const envConfig = this.getEnvConfig();

    let dbToken = null;
    try {
      dbToken = await IntegrationToken.findOne({ provider: PROVIDER, accountKey: ACCOUNT_KEY });
    } catch (e) {
      // In case collection not initialized yet
    }

    let token = null;
    if (dbToken && dbToken.accessTokenEncrypted) {
      try {
        token = decryptToken(dbToken.accessTokenEncrypted);
      } catch (err) {
        console.error('[ConnectWhatsClient] Failed to decrypt stored token:', err.message);
      }
    }

    if (!token && envConfig.apiKey) {
      token = envConfig.apiKey;
    }

    if (!token) {
      throw new ApiError(400, 'ConnectWhats integration is not configured. Please connect API key.');
    }

    const metadata = dbToken?.metadata || {};
    const rawApiUrl = metadata.apiUrl || envConfig.apiUrl;

    return {
      token,
      apiUrl: normalizeUrl(rawApiUrl),
      instanceId: metadata.instanceId || envConfig.instanceId,
      phoneNumber: metadata.phoneNumber || envConfig.phoneNumber,
      phoneNumberId: metadata.phoneNumberId || envConfig.phoneNumberId,
      wabaId: metadata.wabaId || envConfig.wabaId,
      status: dbToken?.status || (envConfig.isConfigured ? 'connected' : 'disconnected'),
      dbTokenId: dbToken?._id || null,
    };
  }

  /**
   * Low-level HTTP request helper for ConnectWhats API
   */
  async makeRequest({ method = 'GET', endpoint, data, token, baseUrl }) {
    const url = `${normalizeUrl(baseUrl)}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const cleanToken = (token || '').trim();

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${cleanToken}`,
      'x-api-key': cleanToken,
    };

    const reqConfig = {
      method: method.toUpperCase(),
      url,
      headers,
      timeout: 25000,
    };

    if (['POST', 'PUT', 'PATCH'].includes(reqConfig.method) && data) {
      reqConfig.data = data;
    }

    let attempt = 0;
    while (attempt <= MAX_RETRIES) {
      try {
        const response = await axios(reqConfig);
        return response.data;
      } catch (error) {
        const statusCode = error.response?.status || 500;
        const responseMessage =
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.response?.data?.error_user_msg ||
          error.message;

        const isNetworkErr = error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';
        const isRetryable = (statusCode >= 500 || isNetworkErr) && attempt < MAX_RETRIES;

        if (isRetryable) {
          attempt++;
          console.warn(
            `[ConnectWhats] Request failed (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${RETRY_DELAY_MS}ms...`
          );
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
          continue;
        }

        console.error(`[ConnectWhats] ${method} ${endpoint} failed (${statusCode}):`, responseMessage);
        throw new ApiError(statusCode, responseMessage || 'ConnectWhats request failed');
      }
    }
  }

  /**
   * Fetch approved templates directly from ConnectWhats provider
   */
  async getProviderTemplates() {
    const creds = await this.getActiveCredentials();
    const phoneNoId = creds.phoneNumberId || creds.instanceId;
    const endpoint = phoneNoId
      ? `/api/v2/whatsapp-business/templates/${phoneNoId}`
      : '/api/v2/whatsapp-business/templates';

    return await this.makeRequest({
      method: 'GET',
      endpoint,
      token: creds.token,
      baseUrl: creds.apiUrl,
    });
  }
}

module.exports = new ConnectWhatsClient();
