const sieveSizeService = require('./sieveSize.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class SieveSizeController {
  // ------------------------------- create sieve size ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await sieveSizeService.create(req.body);
    await redisClient.deleteByPattern('sieve-sizes:*');
    ApiResponse.created(res, null, 'Sieve size created successfully');
  });

  // ------------------------------- get all sieve sizes ----------------------------

  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await sieveSizeService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Sieve sizes retrieved successfully'
    );
  });

  // ------------------------------- get sieve size lookup ----------------------------

  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `sieve-sizes:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => sieveSizeService.getLookup(req.query));
    ApiResponse.success(res, items, 'Sieve size lookup list retrieved');
  });

  // ------------------------------- get one sieve size ----------------------------

  getOne = catchAsync(async (req, res) => {
    const item = await sieveSizeService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Sieve size retrieved successfully');
  });

  // ------------------------------- update sieve size ----------------------------

  update = catchAsync(async (req, res) => {
    const item = await sieveSizeService.update(req.params.id, req.body);
    await redisClient.deleteByPattern('sieve-sizes:*');
    ApiResponse.success(res, null, 'Sieve size updated successfully');
  });

  // ------------------------------- delete sieve size ----------------------------

  delete = catchAsync(async (req, res) => {
    const result = await sieveSizeService.delete(req.params.id);
    await redisClient.deleteByPattern('sieve-sizes:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new SieveSizeController();
