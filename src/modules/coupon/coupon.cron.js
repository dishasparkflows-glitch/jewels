const cron = require('node-cron');
const Coupon = require('./coupon.model');
const { CRON_TIME } = require('../../config/constants');

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
  if (expirationJob) return expirationJob;

  setTimeout(() => { expireCoupons('startup'); }, 3000);
  expirationJob = cron.schedule(
    CRON_TIME.COUPON_EXPIRATION,
    () => { expireCoupons(); },
    { timezone: 'Asia/Kolkata' }
  );
  console.log(`[Coupon Cron] Scheduled coupon expiration at "${CRON_TIME.COUPON_EXPIRATION}" (Asia/Kolkata).`);
  return expirationJob;
}

module.exports = { startCouponExpirationCron, expireCoupons };
