const codSequenceService = require('./codSequence.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class CodSequenceController {
  // ------------------------------- create cod sequence ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await codSequenceService.create(req.body);
    await redisClient.deleteByPattern('cod-sequences:*');
    ApiResponse.created(res, null, 'COD sequence tier created successfully');
  });

  // ------------------------------- get all cod sequences ----------------------------

  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await codSequenceService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'COD sequence tiers retrieved successfully'
    );
  });

  // ------------------------------- get cod sequence lookup ----------------------------

  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `cod-sequences:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => codSequenceService.getLookup(req.query));
    ApiResponse.success(res, items, 'COD sequence lookup list retrieved');
  });

  calculateFee = catchAsync(async (req, res) => {
    const { amount } = req.query;
    const result = await codSequenceService.calculateFee(amount);
    ApiResponse.success(res, result, 'COD fee calculated successfully');
  });

  // ------------------------------- get one cod sequence ----------------------------

  getOne = catchAsync(async (req, res) => {
    const item = await codSequenceService.getOne(req.params.id);
    ApiResponse.success(res, item, 'COD sequence tier retrieved successfully');
  });

  // ------------------------------- update cod sequence ----------------------------

  update = catchAsync(async (req, res) => {
    const item = await codSequenceService.update(req.params.id, req.body);
    await redisClient.deleteByPattern('cod-sequences:*');
    ApiResponse.success(res, null, 'COD sequence tier updated successfully');
  });

  // ------------------------------- delete cod sequence ----------------------------

  delete = catchAsync(async (req, res) => {
    const result = await codSequenceService.delete(req.params.id);
    await redisClient.deleteByPattern('cod-sequences:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new CodSequenceController();
