const birthstoneService = require('./birthstone.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class BirthstoneController {
  // ------------------------------- create birthstone ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await birthstoneService.create(req.body);
    ApiResponse.created(res, item, 'Birthstone created successfully');
  });

  // ------------------------------- get all birthstones ----------------------------

  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await birthstoneService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Birthstones retrieved successfully'
    );
  });

  // ------------------------------- get birthstone lookup ----------------------------

  getLookup = catchAsync(async (req, res) => {
    const items = await birthstoneService.getLookup(req.query);
    ApiResponse.success(res, items, 'Birthstone lookup list retrieved');
  });

  // ------------------------------- get birthstone by month ----------------------------

  getByMonth = catchAsync(async (req, res) => {
    const item = await birthstoneService.getByMonth(req.params.month);
    ApiResponse.success(res, item, 'Birthstone retrieved successfully');
  });

  // ------------------------------- get one birthstone ----------------------------

  getOne = catchAsync(async (req, res) => {
    const item = await birthstoneService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Birthstone retrieved successfully');
  });

  // ------------------------------- update birthstone ----------------------------

  update = catchAsync(async (req, res) => {
    const item = await birthstoneService.update(req.params.id, req.body);
    ApiResponse.success(res, item, 'Birthstone updated successfully');
  });

  // ------------------------------- delete birthstone ----------------------------

  delete = catchAsync(async (req, res) => {
    const result = await birthstoneService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new BirthstoneController();
