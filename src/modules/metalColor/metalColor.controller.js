const metalColorService = require('./metalColor.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class MetalColorController {
  // ------------------------------- create metal color ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await metalColorService.create(req.body);
    await redisClient.deleteByPattern('metal-colors:*');
    ApiResponse.created(res, null, 'Metal color created successfully');
  });

  // ------------------------------- get all metal colors ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await metalColorService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Metal colors retrieved successfully'
    );
  });

  // ------------------------------- get metal color lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `metal-colors:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => metalColorService.getLookup(req.query));
    ApiResponse.success(res, items, 'Metal color lookup list retrieved');
  });

  // ------------------------------- get one metal color ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await metalColorService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Metal color retrieved successfully');
  });

  // ------------------------------- update metal color ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await metalColorService.update(req.params.id, req.body);
    await redisClient.deleteByPattern('metal-colors:*');
    ApiResponse.success(res, null, 'Metal color updated successfully');
  });

  // ------------------------------- delete metal color ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await metalColorService.delete(req.params.id);
    await redisClient.deleteByPattern('metal-colors:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new MetalColorController();
