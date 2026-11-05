const diamondCutService = require('./diamondCut.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class DiamondCutController {
  // ------------------------------- create diamond cut ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await diamondCutService.create(req.body);
    await redisClient.deleteByPattern('diamond-cuts:*');
    ApiResponse.created(res, null, 'Diamond cut created successfully');
  });

  // ------------------------------- get all diamond cuts ----------------------------

  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await diamondCutService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Diamond cuts retrieved successfully'
    );
  });

  // ------------------------------- get diamond cut lookup ----------------------------

  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `diamond-cuts:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => diamondCutService.getLookup(req.query));
    ApiResponse.success(res, items, 'Diamond cut lookup list retrieved');
  });

  // ------------------------------- get one diamond cut ----------------------------

  getOne = catchAsync(async (req, res) => {
    const item = await diamondCutService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Diamond cut retrieved successfully');
  });

  // ------------------------------- update diamond cut ----------------------------

  update = catchAsync(async (req, res) => {
    const item = await diamondCutService.update(req.params.id, req.body);
    await redisClient.deleteByPattern('diamond-cuts:*');
    ApiResponse.success(res, null, 'Diamond cut updated successfully');
  });

  // ------------------------------- delete diamond cut ----------------------------

  delete = catchAsync(async (req, res) => {
    const result = await diamondCutService.delete(req.params.id);
    await redisClient.deleteByPattern('diamond-cuts:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new DiamondCutController();
