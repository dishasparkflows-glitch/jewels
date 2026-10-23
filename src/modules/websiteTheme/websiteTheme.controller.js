const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const websiteThemeService = require('./websiteTheme.service');

class WebsiteThemeController {
  // ------------------------------- get public config ----------------------------
  getPublicConfig = catchAsync(async (_req, res) => {
    const config = await websiteThemeService.getPublicConfig();
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.set('ETag', `"website-theme-${config.revision}"`);
    ApiResponse.success(res, config, 'Website configuration retrieved successfully');
  });

  // ------------------------------- get all website themes ----------------------------
  list = catchAsync(async (req, res) => {
    const { items, pagination } = await websiteThemeService.list(req.query);
    ApiResponse.paginated(res, items, pagination, 'Website themes retrieved successfully');
  });

  // ------------------------------- get one website theme ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await websiteThemeService.getById(req.params.id);
    ApiResponse.success(res, item, 'Website theme retrieved successfully');
  });

  // ------------------------------- create website theme ----------------------------
  create = catchAsync(async (req, res) => {
    const theme = await websiteThemeService.create(req.body, req.user?._id);
    ApiResponse.created(res, theme, 'Website theme created successfully');
  });

  // ------------------------------- update website theme ----------------------------
  update = catchAsync(async (req, res) => {
    const theme = await websiteThemeService.update(req.params.id, req.body, req.user?._id);
    ApiResponse.success(res, theme, 'Website theme updated successfully');
  });

  // ------------------------------- save theme media ----------------------------
  saveMedia = catchAsync(async (req, res) => {
    const config = await websiteThemeService.saveMedia(req.params.id, req.body, req.user?._id);
    ApiResponse.success(res, config, 'Theme image saved to draft');
  });

  // ------------------------------- duplicate website theme ----------------------------
  duplicate = catchAsync(async (req, res) => {
    const theme = await websiteThemeService.duplicate(req.params.id, req.user?._id);
    ApiResponse.created(res, theme, 'Website theme duplicated successfully');
  });

  // ------------------------------- preview website theme ----------------------------
  preview = catchAsync(async (req, res) => {
    const item = await websiteThemeService.preview(req.params.id);
    ApiResponse.success(res, item, 'Theme preview retrieved successfully');
  });

  // ------------------------------- publish website theme ----------------------------
  publish = catchAsync(async (req, res) => {
    const result = await websiteThemeService.publish(req.params.id, req.body, req.user?._id);
    ApiResponse.success(res, result, result.scheduled ? 'Website theme scheduled successfully' : 'Website theme published successfully');
  });

  // ------------------------------- archive website theme ----------------------------
  archive = catchAsync(async (req, res) => {
    const theme = await websiteThemeService.archive(req.params.id, req.user?._id);
    ApiResponse.success(res, theme, 'Website theme archived successfully');
  });

  // ------------------------------- rollback website theme ----------------------------
  rollback = catchAsync(async (req, res) => {
    const result = await websiteThemeService.rollback(req.params.id, req.user?._id);
    ApiResponse.success(res, result, 'Website theme restored successfully');
  });

  // ------------------------------- get theme publishing history ----------------------------
  history = catchAsync(async (req, res) => {
    const items = await websiteThemeService.getHistory(req.query.themeId);
    ApiResponse.success(res, items, 'Publishing history retrieved successfully');
  });
}

module.exports = new WebsiteThemeController();
