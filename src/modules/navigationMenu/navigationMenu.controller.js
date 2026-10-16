const navigationMenuService = require('./navigationMenu.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class NavigationMenuController {
  getAll = catchAsync(async (req, res) => {
    const items = await navigationMenuService.getAll(req.query);
    ApiResponse.success(res, items, 'Navigation menus retrieved successfully');
  });

  getOne = catchAsync(async (req, res) => {
    const item = await navigationMenuService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Navigation menu retrieved successfully');
  });

  create = catchAsync(async (req, res) => {
    const item = await navigationMenuService.create(req.body);
    ApiResponse.created(res, item, 'Navigation menu created successfully');
  });

  update = catchAsync(async (req, res) => {
    const item = await navigationMenuService.update(req.params.id, req.body);
    ApiResponse.success(res, item, 'Navigation menu updated successfully');
  });

  delete = catchAsync(async (req, res) => {
    const result = await navigationMenuService.delete(req.params.id);
    ApiResponse.success(res, result, result.message);
  });

  reorder = catchAsync(async (req, res) => {
    const result = await navigationMenuService.reorder(req.body.orderedIds);
    ApiResponse.success(res, result, 'Navigation menus reordered successfully');
  });

  // Section handlers
  addSection = catchAsync(async (req, res) => {
    const menu = await navigationMenuService.addSection(req.params.id, req.body);
    ApiResponse.created(res, menu, 'Menu section added successfully');
  });

  updateSection = catchAsync(async (req, res) => {
    const menu = await navigationMenuService.updateSection(req.params.id, req.params.sectionId, req.body);
    ApiResponse.success(res, menu, 'Menu section updated successfully');
  });

  deleteSection = catchAsync(async (req, res) => {
    const menu = await navigationMenuService.deleteSection(req.params.id, req.params.sectionId);
    ApiResponse.success(res, menu, 'Menu section deleted successfully');
  });

  reorderSections = catchAsync(async (req, res) => {
    const menu = await navigationMenuService.reorderSections(req.params.id, req.body.orderedIds);
    ApiResponse.success(res, menu, 'Menu sections reordered successfully');
  });

  // Item handlers
  addMenuItem = catchAsync(async (req, res) => {
    const menu = await navigationMenuService.addMenuItem(req.params.id, req.params.sectionId, req.body);
    ApiResponse.created(res, menu, 'Menu item added successfully');
  });

  updateMenuItem = catchAsync(async (req, res) => {
    const menu = await navigationMenuService.updateMenuItem(
      req.params.id,
      req.params.sectionId,
      req.params.itemId,
      req.body
    );
    ApiResponse.success(res, menu, 'Menu item updated successfully');
  });

  deleteMenuItem = catchAsync(async (req, res) => {
    const menu = await navigationMenuService.deleteMenuItem(
      req.params.id,
      req.params.sectionId,
      req.params.itemId
    );
    ApiResponse.success(res, menu, 'Menu item deleted successfully');
  });

  reorderMenuItems = catchAsync(async (req, res) => {
    const menu = await navigationMenuService.reorderMenuItems(
      req.params.id,
      req.params.sectionId,
      req.body.orderedIds
    );
    ApiResponse.success(res, menu, 'Menu items reordered successfully');
  });
}

module.exports = new NavigationMenuController();
