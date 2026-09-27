const diamondClarityService = require('./diamondClarity.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class DiamondClarityController {
  // ------------------------------- create diamond clarity ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await diamondClarityService.create(req.body);
    ApiResponse.created(res, item, 'Diamond clarity created successfully');
  });

  // ------------------------------- get all diamond clarities ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await diamondClarityService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Diamond clarities retrieved successfully'
    );
  });

  // ------------------------------- get diamond clarity lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const items = await diamondClarityService.getLookup(req.query);
    ApiResponse.success(res, items, 'Diamond clarity lookup list retrieved');
  });

  // ------------------------------- get one diamond clarity ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await diamondClarityService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Diamond clarity retrieved successfully');
  });

  // ------------------------------- update diamond clarity ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await diamondClarityService.update(req.params.id, req.body);
    ApiResponse.success(res, item, 'Diamond clarity updated successfully');
  });

  // ------------------------------- delete diamond clarity ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await diamondClarityService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new DiamondClarityController();
