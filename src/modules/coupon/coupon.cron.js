const cron = require('node-cron');
const Coupon = require('./coupon.model');

let expirationJob = null;
let isUpdating = false;

async function expireCoupons(source = 'scheduled_cron') {
  if (isUpdating) return { success: true, skipped: true };

  isUpdating = true;
  try {
    const now = new Date();
    const result = await Coupon.updateMany(
      {
        'meta.deletedAt': null,
        status: { $ne: 'expired' },
        'validity.endDate': { $ne: null, $lt: now },
      },
      { $set: { status: 'expired' } }
    );
    const modifiedCount = result.modifiedCount ?? result.nModified ?? 0;
    console.log(`[Coupon Cron] Marked ${modifiedCount} coupon(s) expired (${source}).`);
    return { success: true, modifiedCount };
  } catch (error) {
    console.error(`[Coupon Cron] Failed to expire coupons (${source}):`, error.message);
    return { success: false, error: error.message };
  } finally {
    isUpdating = false;
  }
}

function startCouponExpirationCron() {
  const enabled = process.env.COUPON_EXPIRATION_CRON_ENABLED !== 'false';
  const schedule = process.env.COUPON_EXPIRATION_CRON || '0 0 * * *';
  const timezone = process.env.COUPON_EXPIRATION_TIMEZONE || 'Asia/Kolkata';

  if (!enabled) {
    console.log('[Coupon Cron] Coupon expiration cron is disabled.');
    return null;
  }

  if (!cron.validate(schedule)) {
    console.error(`[Coupon Cron] Invalid cron expression: "${schedule}". Cron will not start.`);
    return null;
  }

  if (expirationJob) return expirationJob;

  setTimeout(() => { expireCoupons('startup'); }, 3000);
  expirationJob = cron.schedule(schedule, () => { expireCoupons(); }, { timezone });
  console.log(`[Coupon Cron] Scheduled coupon expiration at "${schedule}" (${timezone}).`);
  return expirationJob;
}

module.exports = { startCouponExpirationCron, expireCoupons };
