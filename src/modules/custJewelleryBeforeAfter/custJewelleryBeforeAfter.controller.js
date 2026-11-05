const custJewelleryBeforeAfterService = require('./custJewelleryBeforeAfter.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class CustJewelleryBeforeAfterController {
  // ------------------------------- create cust jewellery before after ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await custJewelleryBeforeAfterService.create(req.body);
    await redisClient.deleteByPattern('cust-jewellery-before-after:*');
    ApiResponse.created(res, null,
      'Before/After showcase entry created successfully'
    );
  });

  // ------------------------------- get all cust jewellery before after ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } =
      await custJewelleryBeforeAfterService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Before/After showcase entries retrieved successfully'
    );
  });

  // ------------------------------- get cust jewellery before after lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `cust-jewellery-before-after:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => custJewelleryBeforeAfterService.getLookup(req.query));
    ApiResponse.success(
      res,
      items,
      'Before/After showcase lookup list retrieved'
    );
  });

  // ------------------------------- get one cust jewellery before after ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await custJewelleryBeforeAfterService.getOne(req.params.id);
    ApiResponse.success(
      res,
      item,
      'Before/After showcase entry retrieved successfully'
    );
  });

  // ------------------------------- update cust jewellery before after ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await custJewelleryBeforeAfterService.update(
      req.params.id,
      req.body
    );
    await redisClient.deleteByPattern('cust-jewellery-before-after:*');
    ApiResponse.success(res, null, 'Before/After showcase entry updated successfully'
    );
  });

  // ------------------------------- delete cust jewellery before after ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await custJewelleryBeforeAfterService.delete(req.params.id);
    await redisClient.deleteByPattern('cust-jewellery-before-after:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new CustJewelleryBeforeAfterController();
