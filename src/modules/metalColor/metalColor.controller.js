const metalColorService = require('./metalColor.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class MetalColorController {
  // ------------------------------- create metal color ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await metalColorService.create(req.body);
    ApiResponse.created(res, item, 'Metal color created successfully');
  });

  // ------------------------------- get all metal colors ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await metalColorService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Metal colors retrieved successfully'
    );
  });

  // ------------------------------- get metal color lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const items = await metalColorService.getLookup(req.query);
    ApiResponse.success(res, items, 'Metal color lookup list retrieved');
  });

  // ------------------------------- get one metal color ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await metalColorService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Metal color retrieved successfully');
  });

  // ------------------------------- update metal color ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await metalColorService.update(req.params.id, req.body);
    ApiResponse.success(res, item, 'Metal color updated successfully');
  });

  // ------------------------------- delete metal color ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await metalColorService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new MetalColorController();
