const themeMediaMappingService = require('./themeMediaMapping.service');
const ApiResponse = require('../../utils/ApiResponse');
const catchAsync = require('../../utils/catchAsync');

class ThemeMediaMappingController {
  getSupportedModules = catchAsync(async (req, res) => {
    const modules = themeMediaMappingService.getSupportedModules();
    ApiResponse.success(res, modules, 'Supported modules retrieved successfully');
  });

  getModuleRecords = catchAsync(async (req, res) => {
    const { themeId } = req.params;
    const { module, page, limit, search } = req.query;

    const data = await themeMediaMappingService.getModuleRecords({
      themeId,
      module,
      page,
      limit,
      search,
    });

    ApiResponse.success(res, data, 'Module records retrieved successfully');
  });

  getThemeMappings = catchAsync(async (req, res) => {
    const { themeId } = req.params;
    const { module } = req.query;

    const mappings = await themeMediaMappingService.getThemeMappings({
      themeId,
      module,
    });

    ApiResponse.success(res, mappings, 'Theme mappings retrieved successfully');
  });

  upsert = catchAsync(async (req, res) => {
    const { themeId } = req.params;
    const { module, recordId, mediaId, device, placement, status } = req.body;

    const result = await themeMediaMappingService.upsertMapping({
      themeId,
      module,
      recordId,
      mediaId,
      device,
      placement,
      status,
      userId: req.user?._id,
    });

    ApiResponse.success(res, result.mapping, result.message);
  });

  deleteMapping = catchAsync(async (req, res) => {
    const { themeId, mappingId } = req.params;

    const result = await themeMediaMappingService.deleteMapping({
      themeId,
      mappingId,
    });

    ApiResponse.success(res, { id: result.id }, result.message);
  });

  deleteMappingByTarget = catchAsync(async (req, res) => {
    const { themeId } = req.params;
    const { module, recordId, device, placement } = req.query;

    const result = await themeMediaMappingService.deleteMappingByTarget({
      themeId,
      module,
      recordId,
      device,
      placement,
    });

    ApiResponse.success(res, null, result.message);
  });

  bulkSave = catchAsync(async (req, res) => {
    const { themeId } = req.params;
    const { mappings } = req.body;

    const result = await themeMediaMappingService.bulkSaveMappings({
      themeId,
      mappings,
      userId: req.user?._id,
    });

    ApiResponse.success(res, result, result.message);
  });

  getSummary = catchAsync(async (req, res) => {
    const { themeId } = req.params;

    const summary = await themeMediaMappingService.getMappingSummary(themeId);
    ApiResponse.success(res, summary, 'Theme mapping summary retrieved successfully');
  });

  activateTheme = catchAsync(async (req, res) => {
    const { themeId } = req.params;

    const result = await themeMediaMappingService.activateTheme(themeId, req.user?._id);
    ApiResponse.success(res, result, result.message);
  });
}

module.exports = new ThemeMediaMappingController();

