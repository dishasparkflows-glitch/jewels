const diamondTypeService = require('./diamondType.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class DiamondTypeController {
  // ------------------------------- create diamond type ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await diamondTypeService.create(req.body);
    await redisClient.deleteByPattern('diamond-types:*');
    ApiResponse.created(res, null, 'Diamond type created successfully');
  });

  // ------------------------------- get all diamond types ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await diamondTypeService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Diamond types retrieved successfully'
    );
  });

  // ------------------------------- get diamond type lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `diamond-types:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => diamondTypeService.getLookup(req.query));
    ApiResponse.success(res, items, 'Diamond type lookup list retrieved');
  });

  // ------------------------------- get one diamond type ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await diamondTypeService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Diamond type retrieved successfully');
  });

  // ------------------------------- update diamond type ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await diamondTypeService.update(req.params.id, req.body);
    await redisClient.deleteByPattern('diamond-types:*');
    ApiResponse.success(res, null, 'Diamond type updated successfully');
  });

  // ------------------------------- delete diamond type ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await diamondTypeService.delete(req.params.id);
    await redisClient.deleteByPattern('diamond-types:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new DiamondTypeController();
