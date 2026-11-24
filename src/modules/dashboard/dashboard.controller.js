const dashboardService = require('./dashboard.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class DashboardController {
  // ------------------------------- GET Dashboard Stats ----------------------------
  // @route   GET /api/dashboard/stats
  getCounts = catchAsync(async (req, res) => {
    const data = await dashboardService.getCounts();
    ApiResponse.success(res, data, 'Dashboard counts retrieved successfully');
  });

  // ------------------------------- GET Top Selling Products ----------------------------
  // @route   GET /api/dashboard/top-selling-products
  getTopSellingProducts = catchAsync(async (req, res) => {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 5));
    const data = await dashboardService.getTopSellingProducts(limit);
    ApiResponse.success(res, data, 'Top selling products retrieved successfully');
  });

  // ------------------------------- GET Recent Orders ----------------------------
  // @route   GET /api/dashboard/recent-orders
  getRecentOrders = catchAsync(async (req, res) => {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 5));
    const data = await dashboardService.getRecentOrders(limit);
    ApiResponse.success(res, data, 'Recent orders retrieved successfully');
  });

  // ------------------------------- GET Dashboard Overview Sections ----------------------------
  // @route   GET /api/dashboard/sections
  getSections = catchAsync(async (req, res) => {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 5));
    const [topSellingProducts, recentOrders] = await Promise.all([
      dashboardService.getTopSellingProducts(limit),
      dashboardService.getRecentOrders(limit),
    ]);
    ApiResponse.success(
      res,
      { topSellingProducts, recentOrders },
      'Dashboard sections retrieved successfully'
    );
  });
}

module.exports = new DashboardController();
