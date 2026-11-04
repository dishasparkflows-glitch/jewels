const filterService = require('./filter.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class FilterController {
  // ------------------------------- get filters ----------------------------
  getFilters = catchAsync(async (req, res) => {
    if (req.query.view === 'admin' || req.query.includeCategories === 'true') {
      const data = await filterService.getAllFiltersWithCategories();
      return ApiResponse.success(res, data, 'All filters with category configs retrieved successfully');
    }
    const data = await filterService.getStorefrontFilters(req.query);
    ApiResponse.success(res, data, 'Filters retrieved successfully');
  });

  // ------------------------------- get all filters with categories ----------------------------
  getAllWithCategories = catchAsync(async (req, res) => {
    const data = await filterService.getAllFiltersWithCategories();
    ApiResponse.success(res, data, 'All filters with category configs retrieved successfully');
  });

  // ------------------------------- update filter categories ----------------------------
  updateFilterCategories = catchAsync(async (req, res) => {
    const list = req.body.categories || req.body;
    const data = await filterService.updateFilterCategories(req.params.filterId, list);
    ApiResponse.success(res, data, 'Filter category assignments updated successfully');
  });

  // ------------------------------- update category filters ----------------------------
  updateCategoryFilters = catchAsync(async (req, res) => {
    const categoryId = req.params.categoryId || req.query.categoryId || req.body.categoryId;
    const filterList = req.body.filters || req.body;
    const data = await filterService.updateCategoryFilters(categoryId, filterList);
    ApiResponse.success(res, data, 'Category filters updated successfully in filters table');
  });

  // ------------------------------- reorder filters ----------------------------
  reorderFilters = catchAsync(async (req, res) => {
    const list = req.body.filterIds || req.body.filters || req.body;
    const data = await filterService.reorderFilters(list);
    ApiResponse.success(res, data, 'Filters reordered successfully');
  });

  // ------------------------------- update filter ----------------------------
  updateFilter = catchAsync(async (req, res) => {
    const data = await filterService.updateFilter(req.params.filterId, req.body);
    ApiResponse.success(res, data, 'Filter updated successfully');
  });
}

module.exports = new FilterController();

