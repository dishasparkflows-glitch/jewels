const diamondShapeService = require('./diamondShape.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class DiamondShapeController {
  // ------------------------------- create diamond shape ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await diamondShapeService.create(req.body);
    await redisClient.deleteByPattern('diamond-shapes:*');
    ApiResponse.created(res, null, 'Diamond shape created successfully');
  });

  // ------------------------------- get all diamond shapes ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await diamondShapeService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Diamond shapes retrieved successfully'
    );
  });

  // ------------------------------- get diamond shape lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `diamond-shapes:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => diamondShapeService.getLookup(req.query));
    ApiResponse.success(res, items, 'Diamond shape lookup list retrieved');
  });

  // ------------------------------- get one diamond shape ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await diamondShapeService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Diamond shape retrieved successfully');
  });

  // ------------------------------- update diamond shape ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await diamondShapeService.update(req.params.id, req.body);
    await redisClient.deleteByPattern('diamond-shapes:*');
    ApiResponse.success(res, null, 'Diamond shape updated successfully');
  });

  // ------------------------------- delete diamond shape ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await diamondShapeService.delete(req.params.id);
    await redisClient.deleteByPattern('diamond-shapes:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new DiamondShapeController();
