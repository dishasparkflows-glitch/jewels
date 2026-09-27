const menuSectionService = require('./menuSection.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class MenuSectionController {
  // ------------------------------- create menu section ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await menuSectionService.create(req.body);
    ApiResponse.created(res, item, 'Menu section created successfully');
  });

  // ------------------------------- get all menu sections ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await menuSectionService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Menu sections retrieved successfully'
    );
  });

  // ------------------------------- get menu section lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const items = await menuSectionService.getLookup(req.query);
    ApiResponse.success(res, items, 'Menu section lookup list retrieved');
  });

  // ------------------------------- get one menu section ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await menuSectionService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Menu section retrieved successfully');
  });

  // ------------------------------- update menu section ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await menuSectionService.update(req.params.id, req.body);
    ApiResponse.success(res, item, 'Menu section updated successfully');
  });

  // ------------------------------- delete menu section ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await menuSectionService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new MenuSectionController();
