const axios = require('axios');
const crypto = require('crypto');
const IntegrationToken = require('../whatsapp/integrationToken.model');
const { encryptToken, decryptToken } = require('../../utils/encryption');

const PROVIDER = 'shiprocket';
const ACCOUNT_KEY = 'default';
const LOCK_DURATION_MS = 30000; // 30s lock duration
const BASE_URL = 'https://apiv2.shiprocket.in/v1/external';

let inProcessRefreshPromise = null;

/**
 * Checks if mock mode should be used
 */
const isMockMode = () => {
  return String(process.env.SHIPROCKET_MOCK_MODE).toLowerCase() === 'true';
};

/**
 * Generates a mock Shiprocket token for local development / testing
 */
const generateMockToken = () => {
  return `mock_sr_jwt_${Buffer.from(JSON.stringify({ sub: 'mock_shiprocket_user', iat: Date.now() })).toString('base64url')}`;
};

/**
 * Authenticates with Shiprocket API v2 to acquire a new JWT token
 */
const fetchNewTokenFromShiprocket = async () => {
  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;

  if (isMockMode() || !email || !password) {
    if (!isMockMode()) {
      console.warn('[Shiprocket] Credentials not configured. Falling back to mock token.');
    }
    return {
      token: generateMockToken(),
      expiresIn: 864000, // 10 days in seconds
    };
  }

  try {
    const response = await axios.post(
      `${BASE_URL}/auth/login`,
      { email, password },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    );

    const token = response.data?.token;
    if (!token) {
      throw new Error(response.data?.message || 'Token not returned by Shiprocket');
    }

    // Shiprocket tokens typically expire in 10 days (864,000 seconds)
    const expiresIn = response.data?.expires_in || 864000;
    return { token, expiresIn };
  } catch (error) {
    console.error('[Shiprocket Auth Error]:', error.response?.data || error.message);
    if (isMockMode()) {
      console.warn('[Shiprocket] Auth failed in mock mode. Returning mock token.');
      return { token: generateMockToken(), expiresIn: 864000 };
    }
    throw new Error(`Shiprocket Authentication Failed: ${error.response?.data?.message || error.message}`);
  }
};

/**
 * Retrieves a valid, unexpired Shiprocket JWT token using:
 * 1. DB Cache Hit (Unexpired)
 * 2. In-Process Mutex Lock
 * 3. MongoDB Distributed Lock
 * 4. AES-256 Decryption
 */
const getValidShiprocketToken = async () => {
  const now = new Date();

  // 1. Check existing unexpired token in DB
  const existingTokenDoc = await IntegrationToken.findOne({
    provider: PROVIDER,
    accountKey: ACCOUNT_KEY,
  }).lean();

  if (
    existingTokenDoc &&
    existingTokenDoc.accessTokenEncrypted &&
    existingTokenDoc.expiresAt &&
    new Date(existingTokenDoc.expiresAt) > now &&
    (!existingTokenDoc.refreshAfter || new Date(existingTokenDoc.refreshAfter) > now)
  ) {
    try {
      const decrypted = decryptToken(existingTokenDoc.accessTokenEncrypted);
      if (decrypted) return decrypted;
    } catch (decErr) {
      console.warn('[Shiprocket] Failed to decrypt cached token. Re-authenticating...', decErr.message);
    }
  }

  // 2. In-Process Mutex: If another request in this process is refreshing, join its promise
  if (inProcessRefreshPromise) {
    return inProcessRefreshPromise;
  }

  // 3. Create In-Process Promise and acquire distributed lock
  inProcessRefreshPromise = (async () => {
    const lockOwner = crypto.randomUUID();
    const lockUntil = new Date(Date.now() + LOCK_DURATION_MS);

    try {
      // Try acquiring MongoDB distributed lock
      const acquired = await IntegrationToken.findOneAndUpdate(
        {
          provider: PROVIDER,
          accountKey: ACCOUNT_KEY,
          $or: [
            { refreshLockUntil: null },
            { refreshLockUntil: { $lte: now } },
          ],
        },
        {
          $set: {
            refreshLockUntil: lockUntil,
            refreshLockOwner: lockOwner,
          },
        },
        { new: true, upsert: true }
      );

      // If lock was not acquired by us, wait briefly and fetch the token refreshed by leader
      if (acquired && acquired.refreshLockOwner !== lockOwner) {
        await new Promise((r) => setTimeout(r, 2000));
        const refreshed = await IntegrationToken.findOne({ provider: PROVIDER, accountKey: ACCOUNT_KEY }).lean();
        if (refreshed?.accessTokenEncrypted) {
          const dec = decryptToken(refreshed.accessTokenEncrypted);
          if (dec) return dec;
        }
      }

      // Leader performs login
      const { token, expiresIn } = await fetchNewTokenFromShiprocket();

      const encrypted = encryptToken(token);
      const issuedAt = new Date();
      const expiresAt = new Date(Date.now() + expiresIn * 1000);
      const refreshAfter = new Date(expiresAt.getTime() - 24 * 60 * 60 * 1000); // 24h prior

      await IntegrationToken.findOneAndUpdate(
        { provider: PROVIDER, accountKey: ACCOUNT_KEY },
        {
          $set: {
            accessTokenEncrypted: encrypted,
            issuedAt,
            expiresAt,
            refreshAfter,
            status: 'connected',
            lastAuthenticatedAt: issuedAt,
            refreshLockUntil: null,
            refreshLockOwner: null,
          },
        },
        { upsert: true }
      );

      return token;
    } catch (err) {
      // Clear lock on failure
      await IntegrationToken.updateOne(
        { provider: PROVIDER, accountKey: ACCOUNT_KEY, refreshLockOwner: lockOwner },
        { $set: { refreshLockUntil: null, refreshLockOwner: null } }
      ).catch(() => {});
      throw err;
    } finally {
      inProcessRefreshPromise = null;
    }
  })();

  return inProcessRefreshPromise;
};

/**
 * Invalidates the currently cached token in DB to trigger fresh login
 */
const invalidateShiprocketToken = async () => {
  await IntegrationToken.updateOne(
    { provider: PROVIDER, accountKey: ACCOUNT_KEY },
    { $set: { expiresAt: new Date(0), refreshAfter: new Date(0) } }
  ).catch(() => {});
};

/**
 * Standardized Shiprocket API request wrapper with 401 retry interceptor
 */
const shiprocketRequest = async (method, endpoint, data = null, params = null) => {
  let attempts = 0;
  while (attempts < 2) {
    try {
      const token = await getValidShiprocketToken();
      const response = await axios({
        method,
        url: `${BASE_URL}${endpoint}`,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data,
        params,
        timeout: 25000,
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401 && attempts === 0) {
        console.warn(`[Shiprocket] 401 Unauthorized on ${endpoint}. Invalidating cached token and retrying...`);
        await invalidateShiprocketToken();
        attempts++;
        continue;
      }
      throw error;
    }
  }
};

module.exports = {
  getValidShiprocketToken,
  invalidateShiprocketToken,
  shiprocketRequest,
  isMockMode,
  BASE_URL,
};
