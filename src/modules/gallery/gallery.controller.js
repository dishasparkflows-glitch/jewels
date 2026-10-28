const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const galleryService = require('./gallery.service');

class GalleryController {
  // ------------------------------- list gallery images ----------------------------
  list = catchAsync(async (req, res) => {
    const data = await galleryService.listImages(req.query);
    ApiResponse.success(res, data, 'Gallery media retrieved successfully');
  });

  // ------------------------------- get one item ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await galleryService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Gallery item retrieved successfully');
  });

  // ------------------------------- create item ----------------------------
  create = catchAsync(async (req, res) => {
    const result = await galleryService.create(req.body, req.user?._id);
    ApiResponse.success(res, result, 'Gallery item created successfully', 201);
  });

  // ------------------------------- upload and assign (alias) ----------------------------
  uploadAndAssign = catchAsync(async (req, res) => {
    const result = await galleryService.uploadAndAssign(req.body, req.user?._id);
    ApiResponse.success(res, result, 'Media assigned successfully', 201);
  });

  // ------------------------------- update item ----------------------------
  update = catchAsync(async (req, res) => {
    const result = await galleryService.update(req.params.id, req.body, req.user?._id);
    ApiResponse.success(res, result, 'Gallery item updated successfully');
  });

  // ------------------------------- toggle status ----------------------------
  toggleStatus = catchAsync(async (req, res) => {
    const result = await galleryService.toggleStatus(req.params.id, req.user?._id);
    ApiResponse.success(res, result, 'Gallery item status updated successfully');
  });

  // ------------------------------- themes lookup ----------------------------
  getThemesLookup = catchAsync(async (req, res) => {
    const themes = await galleryService.getThemesLookup();
    ApiResponse.success(res, themes, 'Themes lookup retrieved successfully');
  });

  // ------------------------------- banners lookup ----------------------------
  getBannersLookup = catchAsync(async (req, res) => {
    const banners = await galleryService.getBannersLookup(req.query.themeId, req.query.type);
    ApiResponse.success(res, banners, 'Banners lookup retrieved successfully');
  });

  // ------------------------------- delete gallery item ----------------------------
  deleteItem = catchAsync(async (req, res) => {
    const result = await galleryService.deleteItem(req.params.id, req.query, req.user?._id);
    ApiResponse.success(res, result, result.message || 'Media item removed successfully');
  });
}

module.exports = new GalleryController();
