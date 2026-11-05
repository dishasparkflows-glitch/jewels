const featuredService = require('./featured.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class FeaturedController {
  // ------------------------------- create featured item ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await featuredService.create(req.body);
    await redisClient.deleteByPattern('featured:*');
    ApiResponse.created(res, null, 'Featured item created successfully');
  });

  // ------------------------------- get all featured items ----------------------------

  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await featuredService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Featured items retrieved successfully'
    );
  });

  // ------------------------------- get featured item lookup ----------------------------

  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `featured:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => featuredService.getLookup(req.query));
    ApiResponse.success(res, items, 'Featured item lookup list retrieved');
  });

  // ------------------------------- get one featured item ----------------------------

  getOne = catchAsync(async (req, res) => {
    const item = await featuredService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Featured item retrieved successfully');
  });

  // ------------------------------- update featured item ----------------------------

  update = catchAsync(async (req, res) => {
    const item = await featuredService.update(req.params.id, req.body);
    await redisClient.deleteByPattern('featured:*');
    ApiResponse.success(res, null, 'Featured item updated successfully');
  });

  // ------------------------------- reorder featured items ----------------------------
  reorder = catchAsync(async (req, res) => {
    const result = await featuredService.reorder(req.body.items);
    await redisClient.deleteByPattern('featured:*');
    ApiResponse.success(res, null, 'Featured items reordered successfully');
  });

  // ------------------------------- delete featured item ----------------------------

  delete = catchAsync(async (req, res) => {
    const result = await featuredService.delete(req.params.id);
    await redisClient.deleteByPattern('featured:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new FeaturedController();
