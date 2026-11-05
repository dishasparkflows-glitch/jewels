const footerSettingsService = require('./footerSettings.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class FooterSettingsController {
  // ------------------------------- get footer settings ----------------------------
  getSettings = catchAsync(async (req, res) => {
    const settings = await footerSettingsService.getSettings();
    ApiResponse.success(res, settings, 'Footer settings retrieved successfully');
  });

  // ------------------------------- update footer settings ----------------------------
  updateSettings = catchAsync(async (req, res) => {
    const settings = await footerSettingsService.updateSettings(req.body);
    await redisClient.deleteByPattern('footer-settings:*');
    ApiResponse.success(res, null, 'Footer settings updated successfully');
  });

  // ------------------------------- create footer settings ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await footerSettingsService.create(req.body);
    await redisClient.deleteByPattern('footer-settings:*');
    ApiResponse.created(res, null, 'Footer settings record created successfully');
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
    const cacheKey = `footer-settings:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => footerSettingsService.getLookup(req.query));
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
    await redisClient.deleteByPattern('footer-settings:*');
    ApiResponse.success(res, null, 'Footer settings record updated successfully');
  });

  // ------------------------------- delete footer settings ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await footerSettingsService.delete(req.params.id);
    await redisClient.deleteByPattern('footer-settings:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new FooterSettingsController();
