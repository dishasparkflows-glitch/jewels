const sizeService = require('./size.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class SizeController {
  // ------------------------------- create size ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await sizeService.create(req.body);
    ApiResponse.created(res, item, 'Size created successfully');
  });

  // ------------------------------- get all sizes ----------------------------

  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await sizeService.getAll(req.query);
    ApiResponse.paginated(res, items, pagination, 'Sizes retrieved successfully');
  });

  // ------------------------------- get size lookup ----------------------------

  getLookup = catchAsync(async (req, res) => {
    const items = await sizeService.getLookup(req.query);
    ApiResponse.success(res, items, 'Size lookup list retrieved');
  });

  // ------------------------------- get one size ----------------------------

  getOne = catchAsync(async (req, res) => {
    const item = await sizeService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Size retrieved successfully');
  });

  // ------------------------------- update size ----------------------------

  update = catchAsync(async (req, res) => {
    const item = await sizeService.update(req.params.id, req.body);
    ApiResponse.success(res, item, 'Size updated successfully');
  });

  // ------------------------------- delete size ----------------------------

  delete = catchAsync(async (req, res) => {
    const result = await sizeService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new SizeController();
