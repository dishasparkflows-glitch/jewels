const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const commonService = require('./common.service');

class CommonController {
  // GET /api/common/bootstrap
  getBootstrap = catchAsync(async (req, res) => {
    const data = await commonService.getBootstrapData();
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.set('ETag', `"bootstrap-${data.revision}"`);
    ApiResponse.success(res, data, 'Storefront bootstrap data retrieved successfully');
  });

  // GET /api/common/revision (lightweight check: ~100 bytes)
  getRevision = catchAsync(async (_req, res) => {
    const data = await commonService.getRevision();
    res.set('Cache-Control', 'no-cache');
    ApiResponse.success(res, data, 'Storefront revision retrieved successfully');
  });
}

module.exports = new CommonController();
