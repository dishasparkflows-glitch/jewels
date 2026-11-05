const diamondClarityService = require('./diamondClarity.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class DiamondClarityController {
  // ------------------------------- create diamond clarity ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await diamondClarityService.create(req.body);
    await redisClient.deleteByPattern('diamond-clarities:*');
    ApiResponse.created(res, null, 'Diamond clarity created successfully');
  });

  // ------------------------------- get all diamond clarities ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await diamondClarityService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Diamond clarities retrieved successfully'
    );
  });

  // ------------------------------- get diamond clarity lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `diamond-clarities:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => diamondClarityService.getLookup(req.query));
    ApiResponse.success(res, items, 'Diamond clarity lookup list retrieved');
  });

  // ------------------------------- get one diamond clarity ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await diamondClarityService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Diamond clarity retrieved successfully');
  });

  // ------------------------------- update diamond clarity ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await diamondClarityService.update(req.params.id, req.body);
    await redisClient.deleteByPattern('diamond-clarities:*');
    ApiResponse.success(res, null, 'Diamond clarity updated successfully');
  });

  // ------------------------------- delete diamond clarity ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await diamondClarityService.delete(req.params.id);
    await redisClient.deleteByPattern('diamond-clarities:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new DiamondClarityController();
