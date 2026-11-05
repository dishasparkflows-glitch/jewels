const reviewService = require('./review.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class ReviewController {
  // ------------------------------- create review ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await reviewService.create(req.body);
    await redisClient.deleteByPattern('reviews:*');
    ApiResponse.created(res, null, 'Review created successfully');
  });

  // ------------------------------- get all reviews ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await reviewService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Reviews retrieved successfully'
    );
  });

  // ------------------------------- get review lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `reviews:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => reviewService.getLookup(req.query));
    ApiResponse.success(res, items, 'Review lookup list retrieved');
  });

  // ------------------------------- get one review ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await reviewService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Review retrieved successfully');
  });

  // ------------------------------- update review ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await reviewService.update(req.params.id, req.body);
    await redisClient.deleteByPattern('reviews:*');
    ApiResponse.success(res, null, 'Review updated successfully');
  });

  // ------------------------------- delete review ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await reviewService.delete(req.params.id);
    await redisClient.deleteByPattern('reviews:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new ReviewController();
