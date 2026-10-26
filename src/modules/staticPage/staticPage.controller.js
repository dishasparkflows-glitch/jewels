const staticPageService = require('./staticPage.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class StaticPageController {
  create = catchAsync(async (req, res) => {
    const page = await staticPageService.create(req.body);
    ApiResponse.created(res, page, 'Static page created successfully');
  });

  getAll = catchAsync(async (req, res) => {
    const pages = await staticPageService.getAll(req.query);
    ApiResponse.success(res, pages, 'Static pages retrieved successfully');
  });

  getOne = catchAsync(async (req, res) => {
    const page = await staticPageService.getOne(req.params.id);
    ApiResponse.success(res, page, 'Static page retrieved successfully');
  });

  getBySlug = catchAsync(async (req, res) => {
    const page = await staticPageService.getBySlug(req.params.slug);
    ApiResponse.success(res, page, 'Static page retrieved successfully');
  });

  update = catchAsync(async (req, res) => {
    const page = await staticPageService.update(req.params.id, req.body);
    ApiResponse.success(res, page, 'Static page updated successfully');
  });

  delete = catchAsync(async (req, res) => {
    const result = await staticPageService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new StaticPageController();
