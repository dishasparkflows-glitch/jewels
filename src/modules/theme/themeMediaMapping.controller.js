const themeMediaMappingService = require('./themeMediaMapping.service');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const catchAsync = require('../../utils/catchAsync');

class ThemeMediaMappingController {
  // ------------------------------- get theme module records ----------------------------
  getModuleRecords = catchAsync(async (req, res) => {
    const { themeId } = req.params;
    const { module, page, limit } = req.query;

    const data = await themeMediaMappingService.getModuleRecords({
      themeId,
      module,
      page,
      limit,
    });

    ApiResponse.success(res, data, 'Module records retrieved successfully');
  });

  // ------------------------------- save / update mapping ----------------------------
  upsert = catchAsync(async (req, res) => {
    const { themeId } = req.params;
    const { recordId, galleryId, mediaId, status } = req.body;

    const result = await themeMediaMappingService.upsertMapping({
      themeId,
      recordId,
      galleryId: galleryId || mediaId,
      status,
    });

    await redisClient.deleteByPattern('themes:*');
    ApiResponse.success(res, result.mapping, result.message);
  });

  // ------------------------------- get mapping summary ----------------------------
  getSummary = catchAsync(async (req, res) => {
    const { themeId } = req.params;

    const summary = await themeMediaMappingService.getMappingSummary(themeId);
    ApiResponse.success(res, summary, 'Theme mapping summary retrieved successfully');
  });

  // ------------------------------- activate theme ----------------------------
  activateTheme = catchAsync(async (req, res) => {
    const { themeId } = req.params;

    const result = await themeMediaMappingService.activateTheme(themeId, req.user?._id);
    await redisClient.deleteByPattern('themes:*');
    await redisClient.deleteByPattern('banners:*');
    await redisClient.deleteByPattern('featured:*');
    await redisClient.deleteByPattern('categories:*');
    await redisClient.deleteByPattern('storefront:*');
    ApiResponse.success(res, result, result.message);
  });
}

module.exports = new ThemeMediaMappingController();
