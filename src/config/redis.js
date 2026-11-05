const redisClient = require('../utils/redisClient');

/**
 * Initializes and verifies Redis connection at server starting time.
 * @returns {Promise<import('ioredis').Redis>}
 */
const connectRedis = async () => {
  try {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      console.warn(`\x1b[33m%s\x1b[0m`, `⚠ REDIS_URL is not defined in .env`);
      return null;
    }

    // Initialize and connect directly with REDIS_URL from .env
    redisClient.init(redisUrl);

    // Verify connection with ping
    const isPong = await redisClient.ping();
    if (isPong) {
      let hostInfo = 'Upstash Redis';
      try {
        const parsed = new URL(redisUrl);
        hostInfo = parsed.hostname;
      } catch (_) {}
      console.log(`\x1b[35m%s\x1b[0m`, `✦ Redis Connected [${hostInfo}]`);
    } else {
      console.warn(`\x1b[33m%s\x1b[0m`, `⚠ Redis initialized but ping did not respond (Status: ${redisClient.getStatus()})`);
    }
  } catch (error) {
    console.error(`\x1b[31m%s\x1b[0m`, `✖ Redis Connection Error: ${error.message}`);
  }

  return redisClient.getClient();
};

const getRedis = () => redisClient.getClient();

module.exports = {
  connectRedis,
  getRedis,
  redisClient,
  cacheHelper: redisClient.cacheHelper,
};
