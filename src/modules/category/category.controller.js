const categoryService = require('./category.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class CategoryController {
  // ------------------------------- create category ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await categoryService.create(req.body);
    await redisClient.deleteByPattern('categories:*');
    ApiResponse.created(res, null, 'Category created successfully');
  });

  // ------------------------------- get all categories ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await categoryService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Categories retrieved successfully'
    );
  });

  // ------------------------------- get category lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `categories:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => categoryService.getLookup(req.query));
    ApiResponse.success(res, items, 'Category lookup list retrieved');
  });

  // ------------------------------- get storefront navigation ----------------------------
  getNavigation = catchAsync(async (req, res) => {
    const data = await categoryService.getNavigation();
    ApiResponse.success(res, data, 'Storefront navigation retrieved successfully');
  });

  // ------------------------------- get one category ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await categoryService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Category retrieved successfully');
  });

  // ------------------------------- update category ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await categoryService.update(req.params.id, req.body);
    await redisClient.deleteByPattern('categories:*');
    ApiResponse.success(res, null, 'Category updated successfully');
  });

  // ------------------------------- delete category ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await categoryService.delete(req.params.id);
    await redisClient.deleteByPattern('categories:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new CategoryController();
