const menuSectionService = require('./menuSection.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class MenuSectionController {
  // ------------------------------- create menu section ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await menuSectionService.create(req.body);
    await redisClient.deleteByPattern('menu-sections:*');
    ApiResponse.created(res, null, 'Menu section created successfully');
  });

  // ------------------------------- get all menu sections ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await menuSectionService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Menu sections retrieved successfully'
    );
  });

  // ------------------------------- get menu section lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `menu-sections:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => menuSectionService.getLookup(req.query));
    ApiResponse.success(res, items, 'Menu section lookup list retrieved');
  });

  // ------------------------------- get one menu section ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await menuSectionService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Menu section retrieved successfully');
  });

  // ------------------------------- update menu section ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await menuSectionService.update(req.params.id, req.body);
    await redisClient.deleteByPattern('menu-sections:*');
    ApiResponse.success(res, null, 'Menu section updated successfully');
  });

  // ------------------------------- reorder menu sections ----------------------------
  reorder = catchAsync(async (req, res) => {
    const items = req.body.items || req.body;
    const result = await menuSectionService.reorder(items);
    await redisClient.deleteByPattern('menu-sections:*');
    ApiResponse.success(res, null, 'Menu sections reordered successfully');
  });

  // ------------------------------- delete menu section ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await menuSectionService.delete(req.params.id);
    await redisClient.deleteByPattern('menu-sections:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new MenuSectionController();
