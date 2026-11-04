const blogService = require('./blog.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class BlogController {
  // ------------------------------- create blog post ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await blogService.create(req.body);
    ApiResponse.created(res, null, 'Blog post created successfully');
  });

  // ------------------------------- get all blog posts ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await blogService.getAll(req.query);
    ApiResponse.paginated(res, items, pagination, 'Blog posts retrieved successfully');
  });

  // ------------------------------- get recent blog posts ----------------------------
  getRecent = catchAsync(async (req, res) => {
    const items = await blogService.getRecent(req.query.limit);
    ApiResponse.success(res, items, 'Recent blog posts retrieved successfully');
  });

  // ------------------------------- get one blog post ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await blogService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Blog post retrieved successfully');
  });

  // ------------------------------- get blog post by slug ----------------------------
  getBySlug = catchAsync(async (req, res) => {
    const item = await blogService.getBySlug(req.params.slug);
    ApiResponse.success(res, item, 'Blog post retrieved successfully');
  });

  // ------------------------------- update blog post ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await blogService.update(req.params.id, req.body);
    ApiResponse.success(res, null, 'Blog post updated successfully');
  });

  // ------------------------------- delete blog post ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await blogService.delete(req.params.id);
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new BlogController();
