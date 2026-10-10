const instagramPostService = require('./instagramPost.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class InstagramPostController {
  // ------------------------------- create instagram post ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await instagramPostService.create(req.body);
    ApiResponse.created(res, item, 'Instagram post created successfully');
  });

  // ------------------------------- get all instagram posts ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await instagramPostService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Instagram posts retrieved successfully'
    );
  });

  // ------------------------------- get instagram post lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const items = await instagramPostService.getLookup(req.query);
    ApiResponse.success(res, items, 'Instagram post lookup list retrieved');
  });

  // ------------------------------- get one instagram post ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await instagramPostService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Instagram post retrieved successfully');
  });

  // ------------------------------- update instagram post ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await instagramPostService.update(req.params.id, req.body);
    ApiResponse.success(res, item, 'Instagram post updated successfully');
  });

  // ------------------------------- reorder instagram posts ----------------------------
  reorder = catchAsync(async (req, res) => {
    const result = await instagramPostService.reorder(req.body.items);
    ApiResponse.success(res, result, 'Instagram posts reordered successfully');
  });

  // ------------------------------- delete instagram post ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await instagramPostService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });

  // ------------------------------- bulk delete instagram posts ----------------------------
  bulkDelete = catchAsync(async (req, res) => {
    const { ids } = req.body;
    const result = await instagramPostService.bulkDelete(ids);
    ApiResponse.success(res, result, result.message);
  });
}

module.exports = new InstagramPostController();
