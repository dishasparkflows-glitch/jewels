const gemstoneTypeService = require('./gemstoneType.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class GemstoneTypeController {
  // ------------------------------- create gemstone type ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await gemstoneTypeService.create(req.body);
    await redisClient.deleteByPattern('gemstone-types:*');
    ApiResponse.created(res, item, 'Gemstone type created successfully');
  });

  // ------------------------------- get all gemstone types ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await gemstoneTypeService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Gemstone types retrieved successfully'
    );
  });

  // ------------------------------- get gemstone type lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `gemstone-types:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => gemstoneTypeService.getLookup(req.query));
    ApiResponse.success(res, items, 'Gemstone type lookup list retrieved');
  });

  // ------------------------------- get one gemstone type ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await gemstoneTypeService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Gemstone type retrieved successfully');
  });

  // ------------------------------- update gemstone type ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await gemstoneTypeService.update(req.params.id, req.body);
    await redisClient.deleteByPattern('gemstone-types:*');
    ApiResponse.success(res, item, 'Gemstone type updated successfully');
  });

  // ------------------------------- delete gemstone type ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await gemstoneTypeService.delete(req.params.id);
    await redisClient.deleteByPattern('gemstone-types:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new GemstoneTypeController();
