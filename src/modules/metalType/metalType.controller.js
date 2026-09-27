const metalTypeService = require('./metalType.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class MetalTypeController {
  // ------------------------------- create metal type ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await metalTypeService.create(req.body);
    ApiResponse.created(res, item, 'Metal type created successfully');
  });

  // ------------------------------- get all metal types ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await metalTypeService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Metal types retrieved successfully'
    );
  });

  // ------------------------------- get metal type lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const items = await metalTypeService.getLookup(req.query);
    ApiResponse.success(res, items, 'Metal type lookup list retrieved');
  });

  // ------------------------------- get one metal type ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await metalTypeService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Metal type retrieved successfully');
  });

  // ------------------------------- update metal type ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await metalTypeService.update(req.params.id, req.body);
    ApiResponse.success(res, item, 'Metal type updated successfully');
  });

  // ------------------------------- delete metal type ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await metalTypeService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new MetalTypeController();
