const gemstoneShapeService = require('./gemstoneShape.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class GemstoneShapeController {
  // ------------------------------- create gemstone shape ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await gemstoneShapeService.create(req.body);
    await redisClient.deleteByPattern('gemstone-shapes:*');
    ApiResponse.created(res, item, 'Gemstone shape created successfully');
  });

  // ------------------------------- get all gemstone shapes ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await gemstoneShapeService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Gemstone shapes retrieved successfully'
    );
  });

  // ------------------------------- get gemstone shape lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `gemstone-shapes:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => gemstoneShapeService.getLookup(req.query));
    ApiResponse.success(res, items, 'Gemstone shape lookup list retrieved');
  });

  // ------------------------------- get one gemstone shape ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await gemstoneShapeService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Gemstone shape retrieved successfully');
  });

  // ------------------------------- update gemstone shape ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await gemstoneShapeService.update(req.params.id, req.body);
    await redisClient.deleteByPattern('gemstone-shapes:*');
    ApiResponse.success(res, item, 'Gemstone shape updated successfully');
  });

  // ------------------------------- delete gemstone shape ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await gemstoneShapeService.delete(req.params.id);
    await redisClient.deleteByPattern('gemstone-shapes:*');
    ApiResponse.success(res, null, result.message);
  });

  // ------------------------------- bulk delete gemstone shapes ----------------------------
  bulkDelete = catchAsync(async (req, res) => {
    const ids = req.body?.ids || [];
    const result = await gemstoneShapeService.bulkDelete(ids);
    await redisClient.deleteByPattern('gemstone-shapes:*');
    ApiResponse.success(res, result, result.message);
  });
}

module.exports = new GemstoneShapeController();
