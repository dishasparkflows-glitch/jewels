const diamondColorService = require('./diamondColor.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class DiamondColorController {
  // ------------------------------- create diamond color ----------------------------
  create = catchAsync(async (req, res) => {
    await diamondColorService.create(req.body);
    await redisClient.deleteByPattern('diamond-colors:*');
    ApiResponse.created(res, null, 'Diamond color created successfully');
  });

  // ------------------------------- get all diamond colors ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await diamondColorService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Diamond colors retrieved successfully'
    );
  });

  // ------------------------------- get diamond color lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `diamond-colors:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => diamondColorService.getLookup(req.query));
    ApiResponse.success(res, items, 'Diamond color lookup list retrieved');
  });

  // ------------------------------- get one diamond color ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await diamondColorService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Diamond color retrieved successfully');
  });

  // ------------------------------- update diamond color ----------------------------
  update = catchAsync(async (req, res) => {
    await diamondColorService.update(req.params.id, req.body);
    await redisClient.deleteByPattern('diamond-colors:*');
    ApiResponse.success(res, null, 'Diamond color updated successfully');
  });

  // ------------------------------- delete diamond color ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await diamondColorService.delete(req.params.id);
    await redisClient.deleteByPattern('diamond-colors:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new DiamondColorController();
