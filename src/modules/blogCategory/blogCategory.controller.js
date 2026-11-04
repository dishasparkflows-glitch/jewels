const blogCategoryService = require('./blogCategory.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class BlogCategoryController {
  // ------------------------------- create blog category ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await blogCategoryService.create(req.body);
    ApiResponse.created(res, null, 'Blog category created successfully');
  });

  // ------------------------------- get all blog categories ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await blogCategoryService.getAll(req.query);
    ApiResponse.paginated(res, items, pagination, 'Blog categories retrieved successfully');
  });

  // ------------------------------- get blog category lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const items = await blogCategoryService.getLookup();
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
    ApiResponse.success(res, null, 'Blog category updated successfully');
  });

  // ------------------------------- delete blog category ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await blogCategoryService.delete(req.params.id);
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new BlogCategoryController();
