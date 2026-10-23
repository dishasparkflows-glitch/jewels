const analyticsService = require('./analytics.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class AnalyticsController {
  getStatus = catchAsync(async (req, res) => {
    const data = await analyticsService.getStatus();
    ApiResponse.success(res, data, 'Analytics status retrieved');
  });

  getOverview = catchAsync(async (req, res) => {
    const { startDate, endDate } = req.query;
    const data = await analyticsService.getOverview({ startDate, endDate });
    ApiResponse.success(res, data, 'Analytics overview retrieved');
  });

  getTimeline = catchAsync(async (req, res) => {
    const { startDate, endDate } = req.query;
    const data = await analyticsService.getTimeline({ startDate, endDate });
    ApiResponse.success(res, data, 'Analytics timeline retrieved');
  });

  getTopProducts = catchAsync(async (req, res) => {
    const { startDate, endDate, limit } = req.query;
    const data = await analyticsService.getTopProducts({
      startDate,
      endDate,
      limit: limit ? Number(limit) : 10,
    });
    ApiResponse.success(res, data, 'Top products retrieved');
  });

  getTrafficSources = catchAsync(async (req, res) => {
    const { startDate, endDate } = req.query;
    const data = await analyticsService.getTrafficSources({ startDate, endDate });
    ApiResponse.success(res, data, 'Traffic sources retrieved');
  });

  getRealtime = catchAsync(async (req, res) => {
    const data = await analyticsService.getRealtime();
    ApiResponse.success(res, data, 'Realtime analytics retrieved');
  });

  getDashboardAll = catchAsync(async (req, res) => {
    const { startDate = '30daysAgo', endDate = 'today' } = req.query;

    const [status, overview, timeline, topProducts, trafficSources, realtime] =
      await Promise.all([
        analyticsService.getStatus(),
        analyticsService.getOverview({ startDate, endDate }),
        analyticsService.getTimeline({ startDate, endDate }),
        analyticsService.getTopProducts({ startDate, endDate, limit: 10 }),
        analyticsService.getTrafficSources({ startDate, endDate }),
        analyticsService.getRealtime(),
      ]);

    ApiResponse.success(
      res,
      {
        status,
        configured: overview.configured || false,
        propertyId: overview.propertyId,
        summary: overview.summary,
        timeline: timeline.timeline || [],
        topProducts: topProducts.topProducts || [],
        trafficSources: trafficSources.trafficSources || [],
        realtime,
      },
      'Dashboard analytics data retrieved'
    );
  });
}

module.exports = new AnalyticsController();
