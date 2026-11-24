const dashboardService = require('./dashboard.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class DashboardController {
  // ------------------------------- GET Dashboard Counts ----------------------------
  // @route   GET /api/dashboard/counts
  getCounts = catchAsync(async (req, res) => {
    const data = await dashboardService.getCounts();
    ApiResponse.success(res, data, 'Dashboard counts retrieved successfully');
  });
}

module.exports = new DashboardController();
