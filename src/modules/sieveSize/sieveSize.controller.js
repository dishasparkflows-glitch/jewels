const sieveSizeService = require('./sieveSize.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class SieveSizeController {
  // ------------------------------- create sieve size ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await sieveSizeService.create(req.body);
    ApiResponse.created(res, item, 'Sieve size created successfully');
  });

  // ------------------------------- get all sieve sizes ----------------------------

  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await sieveSizeService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Sieve sizes retrieved successfully'
    );
  });

  // ------------------------------- get sieve size lookup ----------------------------

  getLookup = catchAsync(async (req, res) => {
    const items = await sieveSizeService.getLookup(req.query);
    ApiResponse.success(res, items, 'Sieve size lookup list retrieved');
  });

  // ------------------------------- get one sieve size ----------------------------

  getOne = catchAsync(async (req, res) => {
    const item = await sieveSizeService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Sieve size retrieved successfully');
  });

  // ------------------------------- update sieve size ----------------------------

  update = catchAsync(async (req, res) => {
    const item = await sieveSizeService.update(req.params.id, req.body);
    ApiResponse.success(res, item, 'Sieve size updated successfully');
  });

  // ------------------------------- delete sieve size ----------------------------

  delete = catchAsync(async (req, res) => {
    const result = await sieveSizeService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new SieveSizeController();
