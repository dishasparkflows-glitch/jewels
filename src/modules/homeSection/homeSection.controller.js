const homeSectionService = require('./homeSection.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class HomeSectionController {
  // ------------------------------- Create Home Section ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await homeSectionService.create(req.body);
    ApiResponse.created(res, null, 'Home section created successfully');
  });

  // ------------------------------- Get All Home Sections (Admin) ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await homeSectionService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Home sections retrieved successfully'
    );
  });


  // ------------------------------- Get One Home Section ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await homeSectionService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Home section retrieved successfully');
  });

  // ------------------------------- Update Home Section ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await homeSectionService.update(req.params.id, req.body);
    ApiResponse.success(res, null, 'Home section updated successfully');
  });

  // ------------------------------- Toggle Status ----------------------------
  toggleStatus = catchAsync(async (req, res) => {
    const item = await homeSectionService.toggleStatus(req.params.id);
    ApiResponse.success(res, null, `Home section marked as ${item.status}`);
  });

  // ------------------------------- Reorder Home Sections ----------------------------
  reorder = catchAsync(async (req, res) => {
    const result = await homeSectionService.reorder(req.body.items);
    ApiResponse.success(res, null, 'Home sections reordered successfully');
  });

  // ------------------------------- Delete Home Section ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await homeSectionService.delete(req.params.id);
    ApiResponse.success(res, null, result.message);
  });

  // ------------------------------- Bulk Delete ----------------------------
  bulkDelete = catchAsync(async (req, res) => {
    const result = await homeSectionService.bulkDelete(req.body.ids);
    ApiResponse.success(res, null, `${result.count} home sections deleted successfully`);
  });

}

module.exports = new HomeSectionController();
