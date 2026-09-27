const footerSettingsService = require('./footerSettings.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class FooterSettingsController {
  // ------------------------------- get footer settings ----------------------------
  getSettings = catchAsync(async (req, res) => {
    const settings = await footerSettingsService.getSettings();
    ApiResponse.success(res, settings, 'Footer settings retrieved successfully');
  });

  // ------------------------------- update footer settings ----------------------------
  updateSettings = catchAsync(async (req, res) => {
    const settings = await footerSettingsService.updateSettings(req.body);
    ApiResponse.success(res, settings, 'Footer settings updated successfully');
  });

  // ------------------------------- create footer settings ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await footerSettingsService.create(req.body);
    ApiResponse.created(res, item, 'Footer settings record created successfully');
  });

  // ------------------------------- get all footer settings ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await footerSettingsService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Footer settings records retrieved successfully'
    );
  });

  // ------------------------------- get footer settings lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const items = await footerSettingsService.getLookup(req.query);
    ApiResponse.success(res, items, 'Footer settings lookup list retrieved');
  });

  // ------------------------------- get one footer settings ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await footerSettingsService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Footer settings record retrieved successfully');
  });

  // ------------------------------- update footer settings record ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await footerSettingsService.update(req.params.id, req.body);
    ApiResponse.success(res, item, 'Footer settings record updated successfully');
  });

  // ------------------------------- delete footer settings ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await footerSettingsService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new FooterSettingsController();
