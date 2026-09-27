const diamondColorService = require('./diamondColor.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class DiamondColorController {
  // ------------------------------- create diamond color ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await diamondColorService.create(req.body);
    ApiResponse.created(res, item, 'Diamond color created successfully');
  });

  // ------------------------------- get all diamond colors ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await diamondColorService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Diamond colors retrieved successfully'
    );
  });

  // ------------------------------- get diamond color lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const items = await diamondColorService.getLookup(req.query);
    ApiResponse.success(res, items, 'Diamond color lookup list retrieved');
  });

  // ------------------------------- get one diamond color ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await diamondColorService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Diamond color retrieved successfully');
  });

  // ------------------------------- update diamond color ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await diamondColorService.update(req.params.id, req.body);
    ApiResponse.success(res, item, 'Diamond color updated successfully');
  });

  // ------------------------------- delete diamond color ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await diamondColorService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new DiamondColorController();
