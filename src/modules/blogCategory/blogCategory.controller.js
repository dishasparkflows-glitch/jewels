const blogCategoryService = require('./blogCategory.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class BlogCategoryController {
  create = catchAsync(async (req, res) => {
    const item = await blogCategoryService.create(req.body);
    ApiResponse.created(res, item, 'Blog category created successfully');
  });

  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await blogCategoryService.getAll(req.query);
    ApiResponse.paginated(res, items, pagination, 'Blog categories retrieved successfully');
  });

  getLookup = catchAsync(async (req, res) => {
    const items = await blogCategoryService.getLookup();
    ApiResponse.success(res, items, 'Blog categories lookup list retrieved');
  });

  getOne = catchAsync(async (req, res) => {
    const item = await blogCategoryService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Blog category retrieved successfully');
  });

  getBySlug = catchAsync(async (req, res) => {
    const item = await blogCategoryService.getBySlug(req.params.slug);
    ApiResponse.success(res, item, 'Blog category retrieved successfully');
  });

  update = catchAsync(async (req, res) => {
    const item = await blogCategoryService.update(req.params.id, req.body);
    ApiResponse.success(res, item, 'Blog category updated successfully');
  });

  delete = catchAsync(async (req, res) => {
    const result = await blogCategoryService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new BlogCategoryController();
