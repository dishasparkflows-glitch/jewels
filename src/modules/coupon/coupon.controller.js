const couponService = require('./coupon.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class CouponController {
  // ------------------------------- create coupon ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await couponService.create(req.body);
    await redisClient.deleteByPattern('coupons:*');
    ApiResponse.created(res, null, 'Coupon created successfully');
  });

  // ------------------------------- get all coupons ----------------------------

  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await couponService.getAll(req.query);
    ApiResponse.paginated(res, items, pagination, 'Coupons retrieved successfully');
  });

  // ------------------------------- get coupon lookup ----------------------------

  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `coupons:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => couponService.getLookup(req.query));
    ApiResponse.success(res, items, 'Coupon lookup list retrieved');
  });

  // ------------------------------- get one coupon ----------------------------

  getOne = catchAsync(async (req, res) => {
    const item = await couponService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Coupon retrieved successfully');
  });

  // ------------------------------- get coupon by code ----------------------------

  getByCode = catchAsync(async (req, res) => {
    const item = await couponService.getByCode(req.params.code);
    ApiResponse.success(res, item, 'Coupon retrieved successfully');
  });

  // ------------------------------- validate coupon ----------------------------

  validateCoupon = catchAsync(async (req, res) => {
    const { code, cartAmount } = req.body;
    const result = await couponService.validateCoupon(code, cartAmount);
    ApiResponse.success(res, result, 'Coupon validated successfully');
  });

  // ------------------------------- update coupon ----------------------------

  update = catchAsync(async (req, res) => {
    const item = await couponService.update(req.params.id, req.body);
    await redisClient.deleteByPattern('coupons:*');
    ApiResponse.success(res, null, 'Coupon updated successfully');
  });

  // ------------------------------- delete coupon ----------------------------

  delete = catchAsync(async (req, res) => {
    const result = await couponService.delete(req.params.id);
    await redisClient.deleteByPattern('coupons:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new CouponController();
