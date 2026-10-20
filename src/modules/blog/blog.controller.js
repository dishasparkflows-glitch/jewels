const blogService = require('./blog.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class BlogController {
  create = catchAsync(async (req, res) => {
    const item = await blogService.create(req.body);
    ApiResponse.created(res, item, 'Blog post created successfully');
  });

  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await blogService.getAll(req.query);
    ApiResponse.paginated(res, items, pagination, 'Blog posts retrieved successfully');
  });

  getRecent = catchAsync(async (req, res) => {
    const items = await blogService.getRecent(req.query.limit);
    ApiResponse.success(res, items, 'Recent blog posts retrieved successfully');
  });

  getOne = catchAsync(async (req, res) => {
    const item = await blogService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Blog post retrieved successfully');
  });

  getBySlug = catchAsync(async (req, res) => {
    const item = await blogService.getBySlug(req.params.slug);
    ApiResponse.success(res, item, 'Blog post retrieved successfully');
  });

  update = catchAsync(async (req, res) => {
    const item = await blogService.update(req.params.id, req.body);
    ApiResponse.success(res, item, 'Blog post updated successfully');
  });

  delete = catchAsync(async (req, res) => {
    const result = await blogService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new BlogController();
