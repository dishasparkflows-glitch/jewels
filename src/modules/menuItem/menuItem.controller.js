const menuItemService = require('./menuItem.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class MenuItemController {
  // ------------------------------- create menu item ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await menuItemService.create(req.body);
    ApiResponse.created(res, item, 'Menu item created successfully');
  });

  // ------------------------------- get all menu items ----------------------------

  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await menuItemService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Menu items retrieved successfully'
    );
  });

  // ------------------------------- get menu item lookup ----------------------------

  getLookup = catchAsync(async (req, res) => {
    const items = await menuItemService.getLookup(req.query);
    ApiResponse.success(res, items, 'Menu item lookup list retrieved');
  });

  // ------------------------------- get one menu item ----------------------------

  getOne = catchAsync(async (req, res) => {
    const item = await menuItemService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Menu item retrieved successfully');
  });

  // ------------------------------- update menu item ----------------------------

  update = catchAsync(async (req, res) => {
    const item = await menuItemService.update(req.params.id, req.body);
    ApiResponse.success(res, item, 'Menu item updated successfully');
  });

  // ------------------------------- delete menu item ----------------------------

  delete = catchAsync(async (req, res) => {
    const result = await menuItemService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new MenuItemController();
