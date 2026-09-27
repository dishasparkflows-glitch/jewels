const codSequenceService = require('./codSequence.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class CodSequenceController {
  // ------------------------------- create cod sequence ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await codSequenceService.create(req.body);
    ApiResponse.created(res, item, 'COD sequence tier created successfully');
  });

  // ------------------------------- get all cod sequences ----------------------------

  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await codSequenceService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'COD sequence tiers retrieved successfully'
    );
  });

  // ------------------------------- get cod sequence lookup ----------------------------

  getLookup = catchAsync(async (req, res) => {
    const items = await codSequenceService.getLookup(req.query);
    ApiResponse.success(res, items, 'COD sequence lookup list retrieved');
  });

  calculateFee = catchAsync(async (req, res) => {
    const { amount } = req.query;
    const result = await codSequenceService.calculateFee(amount);
    ApiResponse.success(res, result, 'COD fee calculated successfully');
  });

  // ------------------------------- get one cod sequence ----------------------------

  getOne = catchAsync(async (req, res) => {
    const item = await codSequenceService.getOne(req.params.id);
    ApiResponse.success(res, item, 'COD sequence tier retrieved successfully');
  });

  // ------------------------------- update cod sequence ----------------------------

  update = catchAsync(async (req, res) => {
    const item = await codSequenceService.update(req.params.id, req.body);
    ApiResponse.success(res, item, 'COD sequence tier updated successfully');
  });

  // ------------------------------- delete cod sequence ----------------------------

  delete = catchAsync(async (req, res) => {
    const result = await codSequenceService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new CodSequenceController();
