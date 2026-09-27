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

  // ------------------------------- get banner lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const items = await bannerService.getLookup(req.query);
    ApiResponse.success(res, items, 'Banner lookup list retrieved');
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
}

module.exports = new BannerController();
