const diamondPriceNewService = require('./diamondPriceNew.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class DiamondPriceNewController {
  // ------------------------------- create diamond price new ----------------------------
  create = catchAsync(async (req, res) => {
    if (req.user && req.user._id) {
      req.body.updatedBy = req.user._id;
    }
    const item = await diamondPriceNewService.create(req.body);
    ApiResponse.created(
      res,
      item,
      'Diamond price configuration created successfully'
    );
  });

  // ------------------------------- get all diamond prices new ----------------------------

  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await diamondPriceNewService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Diamond price configurations retrieved successfully'
    );
  });

  // ------------------------------- get diamond price new lookup ----------------------------

  getLookup = catchAsync(async (req, res) => {
    const items = await diamondPriceNewService.getLookup(req.query);
    ApiResponse.success(
      res,
      items,
      'Diamond price configuration lookup list retrieved'
    );
  });

  // ------------------------------- get one diamond price new ----------------------------

  getOne = catchAsync(async (req, res) => {
    const item = await diamondPriceNewService.getOne(req.params.id);
    ApiResponse.success(
      res,
      item,
      'Diamond price configuration retrieved successfully'
    );
  });

  // ------------------------------- update diamond price new ----------------------------

  update = catchAsync(async (req, res) => {
    if (req.user && req.user._id) {
      req.body.updatedBy = req.user._id;
    }
    const item = await diamondPriceNewService.update(req.params.id, req.body);
    ApiResponse.success(
      res,
      item,
      'Diamond price configuration updated successfully'
    );
  });

  // ------------------------------- delete diamond price new ----------------------------

  delete = catchAsync(async (req, res) => {
    const result = await diamondPriceNewService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new DiamondPriceNewController();
