const cron = require('node-cron');
const bannerService = require('./banner.service');

let cronJob = null;
let isCleaning = false;
let lastCleanTime = null;
let lastCleanResult = null;

/**
 * Triggers the expired offer banner auto-deletion process.
 * Guards against concurrent overlapping runs.
 */
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

/**
 * Starts the recurring expired offer cleanup cron job.
 * Default runs every 5 minutes ('* /5 * * * *') or configurable via OFFER_EXPIRATION_CRON.
 */
function startBannerCron() {
  const isEnabled = process.env.OFFER_EXPIRATION_CRON_ENABLED !== 'false';
  const cronSchedule = process.env.OFFER_EXPIRATION_CRON || '*/5 * * * *';

  if (!isEnabled) {
    console.log('[Banner Cron] ⚠️ Offer expiration cron is disabled via OFFER_EXPIRATION_CRON_ENABLED=false');
    return null;
  }

  if (!cron.validate(cronSchedule)) {
    console.error(`[Banner Cron] ❌ Invalid cron expression: "${cronSchedule}". Cron will not start.`);
    return null;
  }

  // Run cleanup once immediately on startup to prune any offers that expired while server was offline
  setTimeout(() => {
    triggerOfferCleanup('startup');
  }, 3000);

  // Schedule recurring cron
  cronJob = cron.schedule(cronSchedule, () => {
    triggerOfferCleanup('scheduled_cron');
  });

  console.log(`[Banner Cron] 🕒 Expired offer auto-deletion cron scheduled: "${cronSchedule}"`);
  return cronJob;
}

module.exports = {
  startBannerCron,
  triggerOfferCleanup,
};
