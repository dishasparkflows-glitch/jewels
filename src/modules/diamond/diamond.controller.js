const diamondService = require('./diamond.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class DiamondController {
  // ------------------------------- create diamond ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await diamondService.create(req.body);
    ApiResponse.created(res, item, 'Diamond created successfully');
  });

  // ------------------------------- get all diamonds ----------------------------

  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await diamondService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Diamonds retrieved successfully'
    );
  });

  // ------------------------------- get diamond lookup ----------------------------

  getLookup = catchAsync(async (req, res) => {
    const items = await diamondService.getLookup(req.query);
    ApiResponse.success(res, items, 'Diamond lookup list retrieved');
  });

  getBySku = catchAsync(async (req, res) => {
    const item = await diamondService.getBySku(req.params.sku);
    ApiResponse.success(res, item, 'Diamond retrieved successfully');
  });

  // ------------------------------- get one diamond ----------------------------

  getOne = catchAsync(async (req, res) => {
    const item = await diamondService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Diamond retrieved successfully');
  });

  // ------------------------------- update diamond ----------------------------

  update = catchAsync(async (req, res) => {
    const item = await diamondService.update(req.params.id, req.body);
    ApiResponse.success(res, item, 'Diamond updated successfully');
  });

  // ------------------------------- delete diamond ----------------------------

  delete = catchAsync(async (req, res) => {
    const result = await diamondService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new DiamondController();
