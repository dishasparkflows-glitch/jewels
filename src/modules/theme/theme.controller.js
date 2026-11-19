const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');
const { Theme } = require('./theme.model');
const themeService = require('./theme.service');

class ThemeController {
  // ------------------------------- get public config ----------------------------
  getPublicConfig = catchAsync(async (_req, res) => {
    const config = await themeService.getPublicConfig();
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.set('ETag', `"theme-${config.revision}"`);
    ApiResponse.success(res, config, 'Theme configuration retrieved successfully');
  });

  // ------------------------------- get all themes ----------------------------
  list = catchAsync(async (req, res) => {
    const { items, pagination } = await themeService.list(req.query);
    ApiResponse.paginated(res, items, pagination, 'Themes retrieved successfully');
  });

  // ------------------------------- get theme lookup ----------------------------
  getLookup = catchAsync(async (_req, res) => {
    const cacheKey = 'themes:lookup:all';
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, async () => {
      return await Theme.find({ 'meta.deletedAt': null })
        .select('_id name code status description publishedAt schedule')
        .sort({ status: 1, name: 1 })
        .lean();
    });
    ApiResponse.success(res, items, 'Theme lookup list retrieved successfully');
  });

  // ------------------------------- get one theme ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await themeService.getById(req.params.id);
    ApiResponse.success(res, item, 'Theme retrieved successfully');
  });

  // ------------------------------- create theme ----------------------------
  create = catchAsync(async (req, res) => {
    const theme = await themeService.create(req.body, req.user?._id);
    await redisClient.deleteByPattern('themes:*');
    await redisClient.deleteByPattern('website-themes:*');
    ApiResponse.created(res, null, 'Theme created successfully');
  });

  // ------------------------------- update theme ----------------------------
  update = catchAsync(async (req, res) => {
    const theme = await themeService.update(req.params.id, req.body, req.user?._id);
    ApiResponse.success(res, null, 'Theme updated successfully');
  });

  // ------------------------------- save theme media ----------------------------
  saveMedia = catchAsync(async (req, res) => {
    const config = await themeService.saveMedia(req.params.id, req.body, req.user?._id);
    ApiResponse.success(res, config, 'Theme image saved to draft');
  });

  // ------------------------------- duplicate theme ----------------------------
  duplicate = catchAsync(async (req, res) => {
    const theme = await themeService.duplicate(req.params.id, req.user?._id);
    ApiResponse.created(res, null, 'Theme duplicated successfully');
  });

  // ------------------------------- preview theme ----------------------------
  preview = catchAsync(async (req, res) => {
    const item = await themeService.preview(req.params.id);
    ApiResponse.success(res, item, 'Theme preview retrieved successfully');
  });

  // ------------------------------- publish theme ----------------------------
  publish = catchAsync(async (req, res) => {
    const result = await themeService.publish(req.params.id, req.body, req.user?._id);
    ApiResponse.success(res, result, result.scheduled ? 'Theme scheduled successfully' : 'Theme published successfully');
  });

  remove = catchAsync(async (req, res) => {
    ApiResponse.success(res, await themeService.remove(req.params.id, req.user?._id), 'Theme deleted successfully');
  });

  // ------------------------------- archive theme ----------------------------
  archive = catchAsync(async (req, res) => {
    const theme = await themeService.archive(req.params.id, req.user?._id);
    ApiResponse.success(res, null, 'Theme archived successfully');
  });

  // ------------------------------- rollback theme ----------------------------
  rollback = catchAsync(async (req, res) => {
    const result = await themeService.rollback(req.params.id, req.user?._id);
    ApiResponse.success(res, result, 'Theme restored successfully');
  });

  // ------------------------------- get theme publishing history ----------------------------
  history = catchAsync(async (req, res) => {
    const items = await themeService.getHistory(req.query.themeId);
    ApiResponse.success(res, items, 'Publishing history retrieved successfully');
  });

  // ------------------------------- get theme media library ----------------------------
  getMediaLibrary = catchAsync(async (req, res) => {
    const data = await themeService.getMediaLibrary(req.params.id);
    ApiResponse.success(res, data, 'Theme media library retrieved successfully');
  });
}

module.exports = new ThemeController();
