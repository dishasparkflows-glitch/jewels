const customInquiryService = require('./customInquiry.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class CustomInquiryController {
  // Public customer inquiry submission
  // ------------------------------- create custom inquiry ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await customInquiryService.create(req.body);
    ApiResponse.created(
      res,
      item,
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
    const items = await customInquiryService.getLookup(req.query);
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
    ApiResponse.success(res, item, 'Custom inquiry updated successfully');
  });

  // ------------------------------- delete custom inquiry ----------------------------

  delete = catchAsync(async (req, res) => {
    const result = await customInquiryService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new CustomInquiryController();
