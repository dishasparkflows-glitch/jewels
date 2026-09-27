const diamondPriceService = require('./diamondPrice.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class DiamondPriceController {
  // ------------------------------- create diamond price ----------------------------
  create = catchAsync(async (req, res) => {
    if (req.user && req.user._id) {
      req.body.updatedBy = req.user._id;
    }
    const item = await diamondPriceService.create(req.body);
    ApiResponse.created(res, item, 'Diamond price entry created successfully');
  });

  // ------------------------------- get all diamond prices ----------------------------

  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await diamondPriceService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Diamond price entries retrieved successfully'
    );
  });

  // ------------------------------- get diamond price lookup ----------------------------

  getLookup = catchAsync(async (req, res) => {
    const items = await diamondPriceService.getLookup(req.query);
    ApiResponse.success(res, items, 'Diamond price lookup list retrieved');
  });

  // ------------------------------- get one diamond price ----------------------------

  getOne = catchAsync(async (req, res) => {
    const item = await diamondPriceService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Diamond price entry retrieved successfully');
  });

  // ------------------------------- update diamond price ----------------------------

  update = catchAsync(async (req, res) => {
    if (req.user && req.user._id) {
      req.body.updatedBy = req.user._id;
    }
    const item = await diamondPriceService.update(req.params.id, req.body);
    ApiResponse.success(res, item, 'Diamond price entry updated successfully');
  });

  // ------------------------------- delete diamond price ----------------------------

  delete = catchAsync(async (req, res) => {
    const result = await diamondPriceService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new DiamondPriceController();
