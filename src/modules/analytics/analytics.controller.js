const analyticsService = require('./analytics.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class AnalyticsController {
  // ------------------------------- GET Analytics Overview ----------------------------
  // @route   GET /api/admin/analytics/overview
  getOverview = catchAsync(async (req, res) => {
    let { startDate = '30daysAgo', endDate = 'today', limit = 10, offset = 0, page } = req.query;

    const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    let parsedOffset = parseInt(offset, 10);
    if (isNaN(parsedOffset)) {
      const parsedPage = Math.max(1, parseInt(page, 10) || 1);
      parsedOffset = (parsedPage - 1) * parsedLimit;
    }
    parsedOffset = Math.max(0, parsedOffset);

    const data = await analyticsService.getAnalyticsOverview({
      startDate,
      endDate,
      limit: parsedLimit,
      offset: parsedOffset,
    });

    ApiResponse.success(res, data, 'Analytics overview retrieved successfully');
  });

  // ------------------------------- GET Product Add to Cart Report ----------------------------
  // @route   GET /api/admin/analytics/products/add-to-cart
  getProductsAddToCartReport = catchAsync(async (req, res) => {
    const { startDate, endDate, limit, offset, page, sortBy, order, refresh } = req.query;

    const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    let parsedOffset = parseInt(offset, 10);
    if (isNaN(parsedOffset)) {
      const parsedPage = Math.max(1, parseInt(page, 10) || 1);
      parsedOffset = (parsedPage - 1) * parsedLimit;
    }
    parsedOffset = Math.max(0, parsedOffset);

    const report = await analyticsService.getProductAddToCartReport({
      startDate,
      endDate,
      limit: parsedLimit,
      offset: parsedOffset,
      sortBy: sortBy || 'count',
      order: order || 'desc',
      refresh: refresh === 'true',
    });

    if (report && report.success === false) {
      return res.status(report.statusCode || 500).json(report);
    }

    res.status(200).json(report);
  });

  // ------------------------------- GET Product Wishlist Report ----------------------------
  // @route   GET /api/admin/analytics/products/wishlist
  getProductsWishlistReport = catchAsync(async (req, res) => {
    const { startDate, endDate, limit, offset, page, sortBy, order, refresh } = req.query;

    const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    let parsedOffset = parseInt(offset, 10);
    if (isNaN(parsedOffset)) {
      const parsedPage = Math.max(1, parseInt(page, 10) || 1);
      parsedOffset = (parsedPage - 1) * parsedLimit;
    }
    parsedOffset = Math.max(0, parsedOffset);

    const report = await analyticsService.getProductWishlistReport({
      startDate,
      endDate,
      limit: parsedLimit,
      offset: parsedOffset,
      sortBy: sortBy || 'count',
      order: order || 'desc',
      refresh: refresh === 'true',
    });

    if (report && report.success === false) {
      return res.status(report.statusCode || 500).json(report);
    }

    res.status(200).json(report);
  });

  // ------------------------------- GET Analytics Health ----------------------------
  // @route   GET /api/admin/analytics/health
  getAnalyticsHealth = catchAsync(async (req, res) => {
    const result = await analyticsService.testAnalyticsConnection();
    ApiResponse.success(res, result, result.message || 'Analytics health check executed');
  });

  // ------------------------------- GET/POST Google Token ----------------------------
  // @route   GET/POST /api/admin/analytics/google-token
  getGoogleAccessToken = catchAsync(async (req, res) => {
    const tokenData = await analyticsService.getGoogleAccessToken();
    res.status(200).json({
      success: true,
      ...tokenData,
    });
  });

  // ------------------------------- GET Analytics Status ----------------------------
  // @route   GET /api/admin/analytics/status
  getStatus = catchAsync(async (req, res) => {
    const data = await analyticsService.getStatus();
    ApiResponse.success(res, data, 'Analytics status retrieved');
  });

  // ------------------------------- GET Combined Dashboard ----------------------------
  // @route   GET /api/admin/analytics/dashboard
  getDashboardAll = catchAsync(async (req, res) => {
    const { startDate = '30daysAgo', endDate = 'today' } = req.query;
    const overview = await analyticsService.getAnalyticsOverview({ startDate, endDate, limit: 100 });

    ApiResponse.success(
      res,
      {
        configured: overview.configured || false,
        propertyId: overview.propertyId,
        summary: overview.summary,
        timeline: overview.timeline || [],
        topProducts: overview.topProducts || [],
        trafficSources: overview.trafficSources || [],
      },
      'Dashboard analytics data retrieved'
    );
  });
}

module.exports = new AnalyticsController();
