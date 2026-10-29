const bannerService = require('./banner.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class BannerController {
  // ------------------------------- create banner ----------------------------
  create = catchAsync(async (req, res) => {
    const banner = await bannerService.create(req.body);
    ApiResponse.created(res, banner, 'Banner created successfully');
  });

  // ------------------------------- get all banners ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await bannerService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Banners retrieved successfully'
    );
  });

  // ------------------------------- get banner counts by type ----------------------------
  getCounts = catchAsync(async (req, res) => {
    const counts = await bannerService.getCounts();
    ApiResponse.success(res, counts, 'Banner counts retrieved successfully');
  });

  // ------------------------------- get banner lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const items = await bannerService.getLookup(req.query);
    ApiResponse.success(res, items, 'Banner lookup list retrieved');
  });

  // ----------------------- get category display banner ----------------------
  getCategoryDisplayBanner = catchAsync(async (req, res) => {
    const categoryId = req.query.categoryId || req.query.category;
    const result = await bannerService.getCategoryDisplayBanner(categoryId, req.query.platform);
    ApiResponse.success(res, result, 'Display banner retrieved successfully');
  });

  // ------------------------------- get one banner ----------------------------
  getOne = catchAsync(async (req, res) => {
    const banner = await bannerService.getOne(req.params.id);
    ApiResponse.success(res, banner, 'Banner retrieved successfully');
  });

  // ------------------------------- update banner ----------------------------
  update = catchAsync(async (req, res) => {
    const banner = await bannerService.update(req.params.id, req.body);
    ApiResponse.success(res, banner, 'Banner updated successfully');
  });

  // ------------------------------- delete banner ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await bannerService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });

  // ------------------------------- get themes lookup for banners ----------------------------
  getThemesLookup = catchAsync(async (_req, res) => {
    const { WebsiteTheme } = require('../websiteTheme/websiteTheme.model');
    const items = await WebsiteTheme.find({ 'meta.deletedAt': null })
      .select('_id name code status description publishedAt schedule')
      .sort({ status: 1, name: 1 })
      .lean();
    ApiResponse.success(res, items, 'Theme lookup list retrieved successfully');
  });

  // ------------------------------- get theme placement wise images ----------------------------
  getThemeImages = catchAsync(async (req, res) => {
    const galleryService = require('../gallery/gallery.service');
    const { themeId, placement, type, platform, limit } = req.query;
    const data = await galleryService.listImages({
      themeId,
      placement: placement || type,
      platform,
      limit: limit ? parseInt(limit, 10) : 100,
    });
    ApiResponse.success(res, data.items || [], 'Theme images retrieved successfully');
  });

  // ----------------------- manual trigger offer cleanup ---------------------
  cleanupExpiredOffers = catchAsync(async (req, res) => {
    const result = await bannerService.autoDeleteExpiredOffers();
    ApiResponse.success(
      res,
      result,
      `Expired offers cleanup completed. ${result.deletedCount} offers deleted.`
    );
  });
}

module.exports = new BannerController();
