const cron = require('node-cron');
const Coupon = require('./coupon.model');
const { CRON_TIME } = require('../../config/constants');
const redisClient = require('../../utils/redisClient');

let expirationJob = null;
let isUpdating = false;

async function expireCoupons(source = 'scheduled_cron') {
  if (isUpdating) return { success: true, skipped: true };

  isUpdating = true;
  try {
    const now = new Date();
    const expiredCouponsList = await Coupon.find(
      {
        'meta.deletedAt': null,
        status: { $ne: 'expired' },
        'validity.endDate': { $ne: null, $lt: now },
      },
      { _id: 1 }
    ).lean();

    if (expiredCouponsList && expiredCouponsList.length > 0) {
      const expiredIds = expiredCouponsList.map((c) => String(c._id));
      const result = await Coupon.updateMany(
        { _id: { $in: expiredIds } },
        { $set: { status: 'expired' } }
      );
      const modifiedCount = result.modifiedCount ?? result.nModified ?? 0;

      for (const id of expiredIds) {
        await redisClient.deleteByPattern(`coupons:*${id}*`);
      }
      await redisClient.deleteByPattern('coupons:*');

      console.log(`[Coupon Cron] Marked ${modifiedCount} coupon(s) expired (${source}) and invalidated Redis cache.`);
      return { success: true, modifiedCount, expiredIds };
    }

    return { success: true, modifiedCount: 0 };
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
