const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { Theme } = require('./theme.model');
const themeService = require('./theme.service');

class ThemeController {
  // ------------------------------- get all themes ----------------------------
  list = catchAsync(async (req, res) => {
    const { items, pagination } = await themeService.list(req.query);
    ApiResponse.paginated(res, items, pagination, 'Themes retrieved successfully');
  });

  // ------------------------------- get theme lookup ----------------------------
  getLookup = catchAsync(async (_req, res) => {
    const items = await Theme.find({ 'meta.deletedAt': null })
      .select('_id name code status')
      .sort({ name: 1 })
      .lean();
    const mapped = (items || []).map((t) => ({
      ...t,
      isLive: t.status === 'active',
    }));
    ApiResponse.success(res, mapped, 'Theme lookup list retrieved successfully');
  });

  // ------------------------------- get one theme ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await themeService.getById(req.params.id);
    ApiResponse.success(res, item, 'Theme retrieved successfully');
  });

  // ------------------------------- create theme ----------------------------
  create = catchAsync(async (req, res) => {
    await themeService.create(req.body, req.user?._id);
    await redisClient.deleteByPattern('themes:*');
    ApiResponse.created(res, null, 'Theme created successfully');
  });

  // ------------------------------- update theme ----------------------------
  update = catchAsync(async (req, res) => {
    await themeService.update(req.params.id, req.body, req.user?._id);
    ApiResponse.success(res, null, 'Theme updated successfully');
  });

  // ------------------------------- save theme media ----------------------------
  saveMedia = catchAsync(async (req, res) => {
    const config = await themeService.saveMedia(req.params.id, req.body, req.user?._id);
    ApiResponse.success(res, config, 'Theme image saved to draft');
  });

  // ------------------------------- publish theme ----------------------------
  publish = catchAsync(async (req, res) => {
    const result = await themeService.publish(req.params.id, req.body, req.user?._id);
    ApiResponse.success(res, result, result.scheduled ? 'Theme scheduled successfully' : 'Theme published successfully');
  });

  // ------------------------------- remove theme ----------------------------
  remove = catchAsync(async (req, res) => {
    ApiResponse.success(res, await themeService.remove(req.params.id, req.user?._id), 'Theme deleted successfully');
  });
}

module.exports = new ThemeController();
