const staticPageService = require('./staticPage.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class StaticPageController {
    // ------------------------------- create static page ----------------------------
  create = catchAsync(async (req, res) => {
    const page = await staticPageService.create(req.body);
    ApiResponse.created(res, null, 'Static page created successfully');
  });

    // ------------------------------- get all static pages ----------------------------
  getAll = catchAsync(async (req, res) => {
    const pages = await staticPageService.getAll(req.query);
    ApiResponse.success(res, pages, 'Static pages retrieved successfully');
  });

    // ------------------------------- get single static page ----------------------------
  getOne = catchAsync(async (req, res) => {
    const page = await staticPageService.getOne(req.params.id);
    ApiResponse.success(res, page, 'Static page retrieved successfully');
  });

    // ------------------------------- get static page by slug ----------------------------
  getBySlug = catchAsync(async (req, res) => {
    const page = await staticPageService.getBySlug(req.params.slug);
    ApiResponse.success(res, page, 'Static page retrieved successfully');
  });

    // ------------------------------- update static page ----------------------------
  update = catchAsync(async (req, res) => {
    const page = await staticPageService.update(req.params.id, req.body);
    ApiResponse.success(res, null, 'Static page updated successfully');
  });

    // ------------------------------- delete static page ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await staticPageService.delete(req.params.id);
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new StaticPageController();
