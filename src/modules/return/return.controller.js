const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const returnService = require('./return.service');

class ReturnController {
  createReturn = catchAsync(async (req, res) => {
    const returnDoc = await returnService.createReturn(req.body, req.user);
    return ApiResponse.created(res, 'Return request submitted successfully', returnDoc);
  });

  getAllReturns = catchAsync(async (req, res) => {
    const result = await returnService.getAllReturns(req.query);
    return ApiResponse.paginated(res, 'Returns retrieved successfully', result.items, result.pagination);
  });

  getMyReturns = catchAsync(async (req, res) => {
    const result = await returnService.getMyReturns(req.user._id, req.query);
    return ApiResponse.paginated(res, 'My returns retrieved successfully', result.items, result.pagination);
  });

  getReturnById = catchAsync(async (req, res) => {
    const returnDoc = await returnService.getReturnById(req.params.id);
    return ApiResponse.success(res, 'Return details retrieved', returnDoc);
  });

  updateReturnStatus = catchAsync(async (req, res) => {
    const returnDoc = await returnService.updateReturnStatus(req.params.id, req.body);
    return ApiResponse.success(res, 'Return status updated', returnDoc);
  });
}

module.exports = new ReturnController();
