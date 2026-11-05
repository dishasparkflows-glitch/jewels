const birthstoneService = require('./birthstone.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class BirthstoneController {
  // ------------------------------- create birthstone ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await birthstoneService.create(req.body);
    await redisClient.deleteByPattern('birthstones:*');
    ApiResponse.created(res, null, 'Birthstone created successfully');
  });

  // ------------------------------- get all birthstones ----------------------------

  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await birthstoneService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Birthstones retrieved successfully'
    );
  });

  // ------------------------------- get birthstone lookup ----------------------------

  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `birthstones:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => birthstoneService.getLookup(req.query));
    ApiResponse.success(res, items, 'Birthstone lookup list retrieved');
  });

  // ------------------------------- get birthstone by month ----------------------------

  getByMonth = catchAsync(async (req, res) => {
    const item = await birthstoneService.getByMonth(req.params.month);
    ApiResponse.success(res, item, 'Birthstone retrieved successfully');
  });

  // ------------------------------- get one birthstone ----------------------------

  getOne = catchAsync(async (req, res) => {
    const item = await birthstoneService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Birthstone retrieved successfully');
  });

  // ------------------------------- update birthstone ----------------------------

  update = catchAsync(async (req, res) => {
    const item = await birthstoneService.update(req.params.id, req.body);
    await redisClient.deleteByPattern('birthstones:*');
    ApiResponse.success(res, null, 'Birthstone updated successfully');
  });

  // ------------------------------- delete birthstone ----------------------------

  delete = catchAsync(async (req, res) => {
    const result = await birthstoneService.delete(req.params.id);
    await redisClient.deleteByPattern('birthstones:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new BirthstoneController();
