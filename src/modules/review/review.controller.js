const reviewService = require('./review.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class ReviewController {
  // ------------------------------- create review ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await reviewService.create(req.body);
    ApiResponse.created(res, item, 'Review created successfully');
  });

  // ------------------------------- get all reviews ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await reviewService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Reviews retrieved successfully'
    );
  });

  // ------------------------------- get review lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const items = await reviewService.getLookup(req.query);
    ApiResponse.success(res, items, 'Review lookup list retrieved');
  });

  // ------------------------------- get one review ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await reviewService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Review retrieved successfully');
  });

  // ------------------------------- update review ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await reviewService.update(req.params.id, req.body);
    ApiResponse.success(res, item, 'Review updated successfully');
  });

  // ------------------------------- delete review ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await reviewService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new ReviewController();
