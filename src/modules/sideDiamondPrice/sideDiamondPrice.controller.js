const sideDiamondPriceService = require('./sideDiamondPrice.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class SideDiamondPriceController {
  // ------------------------------- create side diamond price ----------------------------
  create = catchAsync(async (req, res) => {
    if (req.user && req.user._id) {
      req.body.updatedBy = req.user._id;
    }
    const item = await sideDiamondPriceService.create(req.body);
    ApiResponse.created(
      res,
      item,
      'Side diamond price entry created successfully'
    );
  });

  // ------------------------------- get all side diamond prices ----------------------------

  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await sideDiamondPriceService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Side diamond price entries retrieved successfully'
    );
  });

  // ------------------------------- get side diamond price lookup ----------------------------

  getLookup = catchAsync(async (req, res) => {
    const items = await sideDiamondPriceService.getLookup(req.query);
    ApiResponse.success(res, items, 'Side diamond price lookup list retrieved');
  });

  // ------------------------------- get one side diamond price ----------------------------

  getOne = catchAsync(async (req, res) => {
    const item = await sideDiamondPriceService.getOne(req.params.id);
    ApiResponse.success(
      res,
      item,
      'Side diamond price entry retrieved successfully'
    );
  });

  // ------------------------------- update side diamond price ----------------------------

  update = catchAsync(async (req, res) => {
    if (req.user && req.user._id) {
      req.body.updatedBy = req.user._id;
    }
    const item = await sideDiamondPriceService.update(req.params.id, req.body);
    ApiResponse.success(
      res,
      item,
      'Side diamond price entry updated successfully'
    );
  });

  // ------------------------------- delete side diamond price ----------------------------

  delete = catchAsync(async (req, res) => {
    const result = await sideDiamondPriceService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new SideDiamondPriceController();
