const metalPurityService = require('./metalPurity.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class MetalPurityController {
  // ------------------------------- create metal purity ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await metalPurityService.create(req.body);
    await redisClient.deleteByPattern('metal-purities:*');
    ApiResponse.created(res, null, 'Metal purity created successfully');
  });

  // ------------------------------- get all metal purities ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await metalPurityService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Metal purities retrieved successfully'
    );
  });

  // ------------------------------- get metal purity lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `metal-purities:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => metalPurityService.getLookup(req.query));
    ApiResponse.success(res, items, 'Metal purity lookup list retrieved');
  });

  // ------------------------------- get one metal purity ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await metalPurityService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Metal purity retrieved successfully');
  });

  // ------------------------------- update metal purity ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await metalPurityService.update(req.params.id, req.body);
    await redisClient.deleteByPattern('metal-purities:*');
    ApiResponse.success(res, null, 'Metal purity updated successfully');
  });

  // ------------------------------- delete metal purity ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await metalPurityService.delete(req.params.id);
    await redisClient.deleteByPattern('metal-purities:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new MetalPurityController();
