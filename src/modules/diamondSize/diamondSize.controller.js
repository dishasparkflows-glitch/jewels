const diamondSizeService = require('./diamondSize.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class DiamondSizeController {
  // ------------------------------- create diamond size ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await diamondSizeService.create(req.body);
    await redisClient.deleteByPattern('diamond-sizes:*');
    ApiResponse.created(res, null, 'Diamond size created successfully');
  });

  // ------------------------------- get all diamond sizes ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await diamondSizeService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Diamond sizes retrieved successfully'
    );
  });

  // ------------------------------- get diamond size lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `diamond-sizes:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => diamondSizeService.getLookup(req.query));
    ApiResponse.success(res, items, 'Diamond size lookup list retrieved');
  });

  // ------------------------------- get one diamond size ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await diamondSizeService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Diamond size retrieved successfully');
  });

  // ------------------------------- update diamond size ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await diamondSizeService.update(req.params.id, req.body);
    await redisClient.deleteByPattern('diamond-sizes:*');
    ApiResponse.success(res, null, 'Diamond size updated successfully');
  });

  // ------------------------------- delete diamond size ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await diamondSizeService.delete(req.params.id);
    await redisClient.deleteByPattern('diamond-sizes:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new DiamondSizeController();
