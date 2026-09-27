const featuredService = require('./featured.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class FeaturedController {
  // ------------------------------- create featured item ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await featuredService.create(req.body);
    ApiResponse.created(res, item, 'Featured item created successfully');
  });

  // ------------------------------- get all featured items ----------------------------

  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await featuredService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Featured items retrieved successfully'
    );
  });

  // ------------------------------- get featured item lookup ----------------------------

  getLookup = catchAsync(async (req, res) => {
    const items = await featuredService.getLookup(req.query);
    ApiResponse.success(res, items, 'Featured item lookup list retrieved');
  });

  // ------------------------------- get one featured item ----------------------------

  getOne = catchAsync(async (req, res) => {
    const item = await featuredService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Featured item retrieved successfully');
  });

  // ------------------------------- update featured item ----------------------------

  update = catchAsync(async (req, res) => {
    const item = await featuredService.update(req.params.id, req.body);
    ApiResponse.success(res, item, 'Featured item updated successfully');
  });

  // ------------------------------- reorder featured items ----------------------------
  reorder = catchAsync(async (req, res) => {
    const result = await featuredService.reorder(req.body.items);
    ApiResponse.success(res, result, 'Featured items reordered successfully');
  });

  // ------------------------------- delete featured item ----------------------------

  delete = catchAsync(async (req, res) => {
    const result = await featuredService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new FeaturedController();
