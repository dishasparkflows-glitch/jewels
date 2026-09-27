const diamondSizeService = require('./diamondSize.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class DiamondSizeController {
  // ------------------------------- create diamond size ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await diamondSizeService.create(req.body);
    ApiResponse.created(res, item, 'Diamond size created successfully');
  });

  // ------------------------------- get all diamond sizes ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await diamondSizeService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Diamond sizes retrieved successfully'
    );
  });

  // ------------------------------- get diamond size lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const items = await diamondSizeService.getLookup(req.query);
    ApiResponse.success(res, items, 'Diamond size lookup list retrieved');
  });

  // ------------------------------- get one diamond size ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await diamondSizeService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Diamond size retrieved successfully');
  });

  // ------------------------------- update diamond size ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await diamondSizeService.update(req.params.id, req.body);
    ApiResponse.success(res, item, 'Diamond size updated successfully');
  });

  // ------------------------------- delete diamond size ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await diamondSizeService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new DiamondSizeController();
