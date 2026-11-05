const metalTypeService = require('./metalType.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class MetalTypeController {
  // ------------------------------- create metal type ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await metalTypeService.create(req.body);
    await redisClient.deleteByPattern('metal-types:*');
    ApiResponse.created(res, null, 'Metal type created successfully');
  });

  // ------------------------------- get all metal types ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await metalTypeService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Metal types retrieved successfully'
    );
  });

  // ------------------------------- get metal type lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `metal-types:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => metalTypeService.getLookup(req.query));
    ApiResponse.success(res, items, 'Metal type lookup list retrieved');
  });

  // ------------------------------- get one metal type ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await metalTypeService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Metal type retrieved successfully');
  });

  // ------------------------------- update metal type ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await metalTypeService.update(req.params.id, req.body);
    await redisClient.deleteByPattern('metal-types:*');
    ApiResponse.success(res, null, 'Metal type updated successfully');
  });

  // ------------------------------- delete metal type ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await metalTypeService.delete(req.params.id);
    await redisClient.deleteByPattern('metal-types:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new MetalTypeController();
