const cron = require('node-cron');
const bannerService = require('./banner.service');
const redisClient = require('../../utils/redisClient');
const { CRON_TIME } = require('../../config/constants');

let cronJob = null;
let isCleaning = false;
let lastCleanTime = null;
let lastCleanResult = null;

async function triggerOfferCleanup(source = 'cron') {
  if (isCleaning) {
    console.warn(`[Banner Cron] ⏳ Offer cleanup already in progress (triggered by ${source}), skipping duplicate trigger.`);
    return { skipped: true, reason: 'Cleanup already in progress' };
  }

  isCleaning = true;
  const startTime = Date.now();

  try {
    const result = await bannerService.autoDeleteExpiredOffers();
    lastCleanTime = new Date();
    lastCleanResult = {
      timestamp: lastCleanTime,
      durationMs: Date.now() - startTime,
      ...result,
    };

    if (result.deletedCount > 0) {
      if (Array.isArray(result.expiredIds) && result.expiredIds.length > 0) {
        for (const id of result.expiredIds) {
          await redisClient.deleteByPattern(`banners:*${id}*`);
        }
      }
      await redisClient.deleteByPattern('banners:*');
      console.log(`[Banner Cron] ✅ Completed expired offer cleanup: auto-deleted ${result.deletedCount} offers in ${Date.now() - startTime}ms [Source: ${source}]`);
    }

    return { success: true, result: lastCleanResult };
  } catch (err) {
    console.error(`[Banner Cron] ❌ Expired offer cleanup error:`, err.message);
    return { success: false, error: err.message };
  } finally {
    isCleaning = false;
  }
}

function startBannerCron() {
  const cronSchedule = CRON_TIME.OFFER_EXPIRATION_CRON || '0 * * * *';

  // Run cleanup once immediately on startup to prune any offers that expired while server was offline
  setTimeout(() => {
    triggerOfferCleanup('startup');
  }, 3000);

  // Schedule recurring cron
  cronJob = cron.schedule(cronSchedule, () => {
    triggerOfferCleanup('scheduled_cron');
  });

  return cronJob;
}

module.exports = {
  startBannerCron,
  triggerOfferCleanup,
};
