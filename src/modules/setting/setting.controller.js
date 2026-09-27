const settingService = require('./setting.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class SettingController {
  // ------------------------------- get settings ----------------------------
  getSettings = catchAsync(async (req, res) => {
    const settings = await settingService.getSettings();
    ApiResponse.success(res, settings, 'System settings retrieved successfully');
  });

  // ------------------------------- update settings ----------------------------
  updateSettings = catchAsync(async (req, res) => {
    const settings = await settingService.updateSettings(req.body);
    ApiResponse.success(res, settings, 'System settings updated successfully');
  });

  // ------------------------------- create setting ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await settingService.create(req.body);
    ApiResponse.created(res, item, 'Setting record created successfully');
  });

  // ------------------------------- get all settings ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await settingService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Settings retrieved successfully'
    );
  });

  // ------------------------------- get setting lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const items = await settingService.getLookup(req.query);
    ApiResponse.success(res, items, 'Setting lookup list retrieved');
  });

  // ------------------------------- get one setting ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await settingService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Setting retrieved successfully');
  });

  // ------------------------------- update setting ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await settingService.update(req.params.id, req.body);
    ApiResponse.success(res, item, 'Setting updated successfully');
  });

  // ------------------------------- delete setting ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await settingService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new SettingController();
