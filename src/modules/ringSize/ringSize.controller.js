const ringSizeService = require('./ringSize.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class RingSizeController {
  // ------------------------------- create ring size ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await ringSizeService.create(req.body);
    ApiResponse.created(res, item, 'Ring size created successfully');
  });

  // ------------------------------- get all ring sizes ----------------------------

  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await ringSizeService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Ring sizes retrieved successfully'
    );
  });

  // ------------------------------- get ring size lookup ----------------------------

  getLookup = catchAsync(async (req, res) => {
    const items = await ringSizeService.getLookup(req.query);
    ApiResponse.success(res, items, 'Ring size lookup list retrieved');
  });

  // ------------------------------- get one ring size ----------------------------

  getOne = catchAsync(async (req, res) => {
    const item = await ringSizeService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Ring size retrieved successfully');
  });

  // ------------------------------- update ring size ----------------------------

  update = catchAsync(async (req, res) => {
    const item = await ringSizeService.update(req.params.id, req.body);
    ApiResponse.success(res, item, 'Ring size updated successfully');
  });

  // ------------------------------- delete ring size ----------------------------

  delete = catchAsync(async (req, res) => {
    const result = await ringSizeService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new RingSizeController();
