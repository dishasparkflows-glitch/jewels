const ringSizeService = require('./ringSize.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class RingSizeController {
  // ------------------------------- create ring size ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await ringSizeService.create(req.body);
    await redisClient.deleteByPattern('ring-sizes:*');
    ApiResponse.created(res, null, 'Ring size created successfully');
  });

  // ------------------------------- get all ring sizes ----------------------------

  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await ringSizeService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Ring sizes retrieved successfully'
    );
  });

  // ------------------------------- get ring size lookup ----------------------------

  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `ring-sizes:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => ringSizeService.getLookup(req.query));
    ApiResponse.success(res, items, 'Ring size lookup list retrieved');
  });

  // ------------------------------- get one ring size ----------------------------

  getOne = catchAsync(async (req, res) => {
    const item = await ringSizeService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Ring size retrieved successfully');
  });

  // ------------------------------- update ring size ----------------------------

  update = catchAsync(async (req, res) => {
    const item = await ringSizeService.update(req.params.id, req.body);
    await redisClient.deleteByPattern('ring-sizes:*');
    ApiResponse.success(res, null, 'Ring size updated successfully');
  });

  // ------------------------------- delete ring size ----------------------------

  delete = catchAsync(async (req, res) => {
    const result = await ringSizeService.delete(req.params.id);
    await redisClient.deleteByPattern('ring-sizes:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new RingSizeController();
