const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const returnService = require('./return.service');

class ReturnController {
  // ------------------------------- create return request ----------------------------
  createReturn = catchAsync(async (req, res) => {
    const returnDoc = await returnService.createReturn(req.body, req.user);
    return ApiResponse.created(res, returnDoc, 'Return request submitted successfully');
  });

  // ------------------------------- get all returns ----------------------------
  getAllReturns = catchAsync(async (req, res) => {
    const result = await returnService.getAllReturns(req.query);
    return ApiResponse.paginated(res, result.items, result.pagination, 'Returns retrieved successfully');
  });

  // ------------------------------- get my returns ----------------------------
  getMyReturns = catchAsync(async (req, res) => {
    const result = await returnService.getMyReturns(req.user._id, req.query);
    return ApiResponse.paginated(res, result.items, result.pagination, 'My returns retrieved successfully');
  });

  // ------------------------------- get return by id ----------------------------
  getReturnById = catchAsync(async (req, res) => {
    const returnDoc = await returnService.getReturnById(req.params.id);
    return ApiResponse.success(res, returnDoc, 'Return details retrieved');
  });

  // ------------------------------- update return status ----------------------------
  updateReturnStatus = catchAsync(async (req, res) => {
    const returnDoc = await returnService.updateReturnStatus(req.params.id, req.body);
    return ApiResponse.success(res, returnDoc, 'Return status updated');
  });
}

module.exports = new ReturnController();
