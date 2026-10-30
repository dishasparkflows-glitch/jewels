const filterService = require('./filter.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class FilterController {
  // ── GET /api/filters?category=... ──
  getFilters = catchAsync(async (req, res) => {
    if (req.query.view === 'admin' || req.query.includeCategories === 'true') {
      const data = await filterService.getAllFiltersWithCategories();
      return ApiResponse.success(res, data, 'All filters with category configs retrieved successfully');
    }
    const data = await filterService.getStorefrontFilters(req.query);
    ApiResponse.success(res, data, 'Filters retrieved successfully');
  });

  // ── GET /api/filters/admin/all ──
  getAllWithCategories = catchAsync(async (req, res) => {
    const data = await filterService.getAllFiltersWithCategories();
    ApiResponse.success(res, data, 'All filters with category configs retrieved successfully');
  });

  // ── PUT /api/filters/:filterId/categories ──
  updateFilterCategories = catchAsync(async (req, res) => {
    const list = req.body.categories || req.body;
    const data = await filterService.updateFilterCategories(req.params.filterId, list);
    ApiResponse.success(res, data, 'Filter category assignments updated successfully');
  });

  // ── PUT /api/filters/category/:categoryId ──
  updateCategoryFilters = catchAsync(async (req, res) => {
    const categoryId = req.params.categoryId || req.query.categoryId || req.body.categoryId;
    const filterList = req.body.filters || req.body;
    const data = await filterService.updateCategoryFilters(categoryId, filterList);
    ApiResponse.success(res, data, 'Category filters updated successfully in filters table');
  });

  // ── PUT /api/filters/admin/reorder ──
  reorderFilters = catchAsync(async (req, res) => {
    const list = req.body.filterIds || req.body.filters || req.body;
    const data = await filterService.reorderFilters(list);
    ApiResponse.success(res, data, 'Filters reordered successfully');
  });

  // ── PUT /api/filters/:filterId ──
  updateFilter = catchAsync(async (req, res) => {
    const data = await filterService.updateFilter(req.params.filterId, req.body);
    ApiResponse.success(res, data, 'Filter updated successfully');
  });
}

module.exports = new FilterController();

