const blogCategoryService = require('./blogCategory.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class BlogCategoryController {
  // ------------------------------- create blog category ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await blogCategoryService.create(req.body);
    await redisClient.deleteByPattern('blog-categories:*');
    ApiResponse.created(res, null, 'Blog category created successfully');
  });

  // ------------------------------- get all blog categories ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await blogCategoryService.getAll(req.query);
    ApiResponse.paginated(res, items, pagination, 'Blog categories retrieved successfully');
  });

  // ------------------------------- get blog category lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `blog-categories:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => blogCategoryService.getLookup());
    ApiResponse.success(res, items, 'Blog categories lookup list retrieved');
  });

  // ------------------------------- get one blog category ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await blogCategoryService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Blog category retrieved successfully');
  });

  // ------------------------------- get blog category by slug ----------------------------
  getBySlug = catchAsync(async (req, res) => {
    const item = await blogCategoryService.getBySlug(req.params.slug);
    ApiResponse.success(res, item, 'Blog category retrieved successfully');
  });

  // ------------------------------- update blog category ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await blogCategoryService.update(req.params.id, req.body);
    await redisClient.deleteByPattern('blog-categories:*');
    ApiResponse.success(res, null, 'Blog category updated successfully');
  });

  // ------------------------------- delete blog category ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await blogCategoryService.delete(req.params.id);
    await redisClient.deleteByPattern('blog-categories:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new BlogCategoryController();
