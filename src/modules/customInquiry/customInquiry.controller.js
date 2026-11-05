const customInquiryService = require('./customInquiry.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class CustomInquiryController {
  // Public customer inquiry submission
  // ------------------------------- create custom inquiry ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await customInquiryService.create(req.body);
    await redisClient.deleteByPattern('custom-inquiries:*');
    ApiResponse.created(res, null,
      'Your custom jewellery inquiry has been submitted successfully'
    );
  });

  // ------------------------------- get all custom inquiries ----------------------------

  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await customInquiryService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Custom inquiries retrieved successfully'
    );
  });

  // ------------------------------- get custom inquiry lookup ----------------------------

  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `custom-inquiries:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => customInquiryService.getLookup(req.query));
    ApiResponse.success(res, items, 'Custom inquiry lookup list retrieved');
  });

  // ------------------------------- get one custom inquiry ----------------------------

  getOne = catchAsync(async (req, res) => {
    const item = await customInquiryService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Custom inquiry retrieved successfully');
  });

  // ------------------------------- update custom inquiry ----------------------------

  update = catchAsync(async (req, res) => {
    const item = await customInquiryService.update(req.params.id, req.body);
    await redisClient.deleteByPattern('custom-inquiries:*');
    ApiResponse.success(res, null, 'Custom inquiry updated successfully');
  });

  // ------------------------------- delete custom inquiry ----------------------------

  delete = catchAsync(async (req, res) => {
    const result = await customInquiryService.delete(req.params.id);
    await redisClient.deleteByPattern('custom-inquiries:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new CustomInquiryController();
