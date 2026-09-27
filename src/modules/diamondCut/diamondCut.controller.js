const diamondCutService = require('./diamondCut.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class DiamondCutController {
  // ------------------------------- create diamond cut ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await diamondCutService.create(req.body);
    ApiResponse.created(res, item, 'Diamond cut created successfully');
  });

  // ------------------------------- get all diamond cuts ----------------------------

  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await diamondCutService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Diamond cuts retrieved successfully'
    );
  });

  // ------------------------------- get diamond cut lookup ----------------------------

  getLookup = catchAsync(async (req, res) => {
    const items = await diamondCutService.getLookup(req.query);
    ApiResponse.success(res, items, 'Diamond cut lookup list retrieved');
  });

  // ------------------------------- get one diamond cut ----------------------------

  getOne = catchAsync(async (req, res) => {
    const item = await diamondCutService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Diamond cut retrieved successfully');
  });

  // ------------------------------- update diamond cut ----------------------------

  update = catchAsync(async (req, res) => {
    const item = await diamondCutService.update(req.params.id, req.body);
    ApiResponse.success(res, item, 'Diamond cut updated successfully');
  });

  // ------------------------------- delete diamond cut ----------------------------

  delete = catchAsync(async (req, res) => {
    const result = await diamondCutService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new DiamondCutController();
