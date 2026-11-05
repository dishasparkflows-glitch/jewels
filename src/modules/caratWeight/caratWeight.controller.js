const caratWeightService = require('./caratWeight.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class CaratWeightController {
  // ------------------------------- create carat weight ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await caratWeightService.create(req.body);
    await redisClient.deleteByPattern('carat-weights:*');
    ApiResponse.created(res, null, 'Carat weight created successfully');
  });

  // ------------------------------- get all carat weights ----------------------------

  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await caratWeightService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Carat weights retrieved successfully'
    );
  });

  // ------------------------------- get carat weight lookup ----------------------------

  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `carat-weights:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => caratWeightService.getLookup(req.query));
    ApiResponse.success(res, items, 'Carat weight lookup list retrieved');
  });

  // ------------------------------- get one carat weight ----------------------------

  getOne = catchAsync(async (req, res) => {
    const item = await caratWeightService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Carat weight retrieved successfully');
  });

  // ------------------------------- update carat weight ----------------------------

  update = catchAsync(async (req, res) => {
    const item = await caratWeightService.update(req.params.id, req.body);
    await redisClient.deleteByPattern('carat-weights:*');
    ApiResponse.success(res, null, 'Carat weight updated successfully');
  });

  // ------------------------------- delete carat weight ----------------------------

  delete = catchAsync(async (req, res) => {
    const result = await caratWeightService.delete(req.params.id);
    await redisClient.deleteByPattern('carat-weights:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new CaratWeightController();
