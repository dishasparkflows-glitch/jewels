const sizeService = require('./size.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class SizeController {
  // ------------------------------- create size ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await sizeService.create(req.body);
    await redisClient.deleteByPattern('sizes:*');
    ApiResponse.created(res, null, 'Size created successfully');
  });

  // ------------------------------- get all sizes ----------------------------

  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await sizeService.getAll(req.query);
    ApiResponse.paginated(res, items, pagination, 'Sizes retrieved successfully');
  });

  // ------------------------------- get size lookup ----------------------------

  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `sizes:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => sizeService.getLookup(req.query));
    ApiResponse.success(res, items, 'Size lookup list retrieved');
  });

  // ------------------------------- get one size ----------------------------

  getOne = catchAsync(async (req, res) => {
    const item = await sizeService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Size retrieved successfully');
  });

  // ------------------------------- update size ----------------------------

  update = catchAsync(async (req, res) => {
    const item = await sizeService.update(req.params.id, req.body);
    await redisClient.deleteByPattern('sizes:*');
    ApiResponse.success(res, null, 'Size updated successfully');
  });

  // ------------------------------- delete size ----------------------------

  delete = catchAsync(async (req, res) => {
    const result = await sizeService.delete(req.params.id);
    await redisClient.deleteByPattern('sizes:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new SizeController();
