const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const websiteThemeService = require('./websiteTheme.service');

class WebsiteThemeController {
  getPublicConfig = catchAsync(async (_req, res) => {
    const config = await websiteThemeService.getPublicConfig();
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.set('ETag', `"website-theme-${config.revision}"`);
    ApiResponse.success(res, config, 'Website configuration retrieved successfully');
  });

  list = catchAsync(async (req, res) => {
    const { items, pagination } = await websiteThemeService.list(req.query);
    ApiResponse.paginated(res, items, pagination, 'Website themes retrieved successfully');
  });

  getOne = catchAsync(async (req, res) => {
    ApiResponse.success(res, await websiteThemeService.getById(req.params.id), 'Website theme retrieved successfully');
  });

  create = catchAsync(async (req, res) => {
    const theme = await websiteThemeService.create(req.body, req.user?._id);
    ApiResponse.created(res, theme, 'Website theme created successfully');
  });

  update = catchAsync(async (req, res) => {
    const theme = await websiteThemeService.update(req.params.id, req.body, req.user?._id);
    ApiResponse.success(res, theme, 'Website theme updated successfully');
  });

  duplicate = catchAsync(async (req, res) => {
    const theme = await websiteThemeService.duplicate(req.params.id, req.user?._id);
    ApiResponse.created(res, theme, 'Website theme duplicated successfully');
  });

  preview = catchAsync(async (req, res) => {
    ApiResponse.success(res, await websiteThemeService.preview(req.params.id), 'Theme preview retrieved successfully');
  });

  publish = catchAsync(async (req, res) => {
    const result = await websiteThemeService.publish(req.params.id, req.body, req.user?._id);
    ApiResponse.success(res, result, result.scheduled ? 'Website theme scheduled successfully' : 'Website theme published successfully');
  });

  archive = catchAsync(async (req, res) => {
    const theme = await websiteThemeService.archive(req.params.id, req.user?._id);
    ApiResponse.success(res, theme, 'Website theme archived successfully');
  });

  rollback = catchAsync(async (req, res) => {
    const result = await websiteThemeService.rollback(req.params.id, req.user?._id);
    ApiResponse.success(res, result, 'Website theme restored successfully');
  });

  history = catchAsync(async (req, res) => {
    ApiResponse.success(res, await websiteThemeService.getHistory(req.query.themeId), 'Publishing history retrieved successfully');
  });
}

module.exports = new WebsiteThemeController();
