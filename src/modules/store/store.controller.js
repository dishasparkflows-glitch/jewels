const storeService = require('./store.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class StoreController {
  // ------------------------------- create store -------------------------------
  create = catchAsync(async (req, res) => {
    const store = await storeService.create(req.body);
    await redisClient.deleteByPattern('stores:*');
    ApiResponse.created(res, store, 'Store created successfully');
  });

  // ------------------------------- get all stores ---------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination, facets } = await storeService.getAll(req.query);
    ApiResponse.paginated(res, items, pagination, 'Stores retrieved successfully', facets);
  });

  // ------------------------------- get store lookup ---------------------------
  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `stores:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => storeService.getLookup(req.query));
    ApiResponse.success(res, items, 'Store lookup list retrieved');
  });

  // ------------------------------- get states summary -------------------------
  getStatesSummary = catchAsync(async (req, res) => {
    const cacheKey = `stores:states:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const data = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => storeService.getStatesSummary(req.query));
    ApiResponse.success(res, data, 'Store states summary retrieved');
  });

  // ------------------------------- get single store ---------------------------
  getOne = catchAsync(async (req, res) => {
    const store = await storeService.getOne(req.params.id);
    ApiResponse.success(res, store, 'Store retrieved successfully');
  });

  // ------------------------------- get store by slug --------------------------
  getBySlug = catchAsync(async (req, res) => {
    const store = await storeService.getBySlug(req.params.slug);
    ApiResponse.success(res, store, 'Store retrieved successfully');
  });

  // ------------------------------- update store -------------------------------
  update = catchAsync(async (req, res) => {
    const store = await storeService.update(req.params.id, req.body);
    await redisClient.deleteByPattern('stores:*');
    ApiResponse.success(res, store, 'Store updated successfully');
  });

  // ------------------------------- toggle status ------------------------------
  toggleStatus = catchAsync(async (req, res) => {
    const store = await storeService.toggleStatus(req.params.id);
    await redisClient.deleteByPattern('stores:*');
    ApiResponse.success(res, store, 'Store status updated successfully');
  });

  // ------------------------------- delete store -------------------------------
  delete = catchAsync(async (req, res) => {
    const result = await storeService.delete(req.params.id);
    await redisClient.deleteByPattern('stores:*');
    ApiResponse.success(res, null, result.message);
  });

  // ------------------------------- bulk delete stores -------------------------
  bulkDelete = catchAsync(async (req, res) => {
    const ids = req.body?.ids || [];
    const result = await storeService.bulkDelete(ids);
    await redisClient.deleteByPattern('stores:*');
    ApiResponse.success(res, result, result.message);
  });
}

module.exports = new StoreController();
