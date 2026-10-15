const topAnnouncementService = require('./topAnnouncement.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class TopAnnouncementController {
  // Global settings
  getSettings = catchAsync(async (req, res) => {
    const settings = await topAnnouncementService.getSettings();
    ApiResponse.success(res, settings, 'Settings retrieved successfully');
  });

  updateSettings = catchAsync(async (req, res) => {
    const settings = await topAnnouncementService.updateSettings(req.body);
    ApiResponse.success(res, settings, 'Settings updated successfully');
  });

  // Storefront Public endpoint
  getPublic = catchAsync(async (req, res) => {
    const data = await topAnnouncementService.getPublic();
    ApiResponse.success(res, data, 'Active top announcements retrieved successfully');
  });

  // Admin list
  getAll = catchAsync(async (req, res) => {
    const { items, pagination, settings } = await topAnnouncementService.getAll(req.query);
    return res.status(200).json({
      success: true,
      message: 'Announcements retrieved successfully',
      data: items,
      pagination,
      settings,
    });
  });

  // Get one
  getOne = catchAsync(async (req, res) => {
    const item = await topAnnouncementService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Announcement retrieved successfully');
  });

  // Create
  create = catchAsync(async (req, res) => {
    const item = await topAnnouncementService.create(req.body);
    ApiResponse.created(res, item, 'Announcement created successfully');
  });

  // Update
  update = catchAsync(async (req, res) => {
    const item = await topAnnouncementService.update(req.params.id, req.body);
    ApiResponse.success(res, item, 'Announcement updated successfully');
  });

  // Toggle Status
  toggleStatus = catchAsync(async (req, res) => {
    const item = await topAnnouncementService.toggleStatus(req.params.id);
    ApiResponse.success(res, item, `Announcement set to ${item.isActive ? 'active' : 'inactive'}`);
  });

  // Duplicate
  duplicate = catchAsync(async (req, res) => {
    const item = await topAnnouncementService.duplicate(req.params.id);
    ApiResponse.created(res, item, 'Announcement duplicated successfully');
  });

  // Reorder
  reorder = catchAsync(async (req, res) => {
    const items = req.body.items || req.body;
    const result = await topAnnouncementService.reorder(items);
    ApiResponse.success(res, result, 'Announcements reordered successfully');
  });


  // Delete
  delete = catchAsync(async (req, res) => {
    const result = await topAnnouncementService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new TopAnnouncementController();
