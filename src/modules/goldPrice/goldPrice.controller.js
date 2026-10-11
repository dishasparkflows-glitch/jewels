const goldPriceService = require('./goldPrice.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class GoldPriceController {
  // ------------------------------- get metal rates ----------------------------
  getLatest = catchAsync(async (req, res) => {
    const price = await goldPriceService.getLatest();
    ApiResponse.success(res, price, 'Real-time metal rates retrieved successfully');
  });

  // ------------------------------- update metal rates ----------------------------
  updateRates = catchAsync(async (req, res) => {
    const price = await goldPriceService.updateRates(req.body, req.user?._id);
    ApiResponse.success(res, price, 'Real-time metal rates updated successfully');
  });
}

module.exports = new GoldPriceController();
