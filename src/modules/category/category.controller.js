const categoryService = require('./category.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class CategoryController {
  // ------------------------------- create category ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await categoryService.create(req.body);
    ApiResponse.created(res, item, 'Category created successfully');
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
    const items = await categoryService.getLookup(req.query);
    ApiResponse.success(res, items, 'Category lookup list retrieved');
  });

  // ------------------------------- get one category ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await categoryService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Category retrieved successfully');
  });

  // ------------------------------- update category ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await categoryService.update(req.params.id, req.body);
    ApiResponse.success(res, item, 'Category updated successfully');
  });

  // ------------------------------- delete category ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await categoryService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new CategoryController();
