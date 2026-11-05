const settingService = require('./setting.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class SettingController {
  // ------------------------------- get settings ----------------------------
  getSettings = catchAsync(async (req, res) => {
    const settings = await settingService.getSettings();
    ApiResponse.success(res, settings, 'System settings retrieved successfully');
  });

  // ------------------------------- get common settings ----------------------------
  getCommonSettings = catchAsync(async (req, res) => {
    const data = await settingService.getCommonSettings();
    ApiResponse.success(res, data, 'Common store settings retrieved successfully');
  });

  // ------------------------------- update settings ----------------------------
  updateSettings = catchAsync(async (req, res) => {
    const settings = await settingService.updateSettings(req.body);
    await redisClient.deleteByPattern('settings:*');
    ApiResponse.success(res, null, 'System settings updated successfully');
  });

  // ------------------------------- create setting ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await settingService.create(req.body);
    await redisClient.deleteByPattern('settings:*');
    ApiResponse.created(res, null, 'Setting record created successfully');
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
    const cacheKey = `settings:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => settingService.getLookup(req.query));
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
    await redisClient.deleteByPattern('settings:*');
    ApiResponse.success(res, null, 'Setting updated successfully');
  });

  // ------------------------------- delete setting ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await settingService.delete(req.params.id);
    await redisClient.deleteByPattern('settings:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new SettingController();
