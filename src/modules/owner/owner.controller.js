const ownerService = require('./owner.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class OwnerController {
  // ------------------------------- get available modules ----------------------------
  getModules = catchAsync(async (req, res) => {
    const data = ownerService.getAvailableModules();
    ApiResponse.success(res, data, 'System modules retrieved successfully');
  });

  // ------------------------------- get owner module access config ----------------------------
  getAccess = catchAsync(async (req, res) => {
    const ownerId = req.query.ownerId || req.headers['x-owner-id'] || req.user?.ownerId || null;
    const { name, databaseUrl } = req.query;
    const access = await ownerService.getAccessConfig({ ownerId, name, databaseUrl });
    ApiResponse.success(res, access, 'Owner access configuration retrieved');
  });

  // ------------------------------- create owner ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await ownerService.create(req.body);
    ApiResponse.created(res, item, 'Owner created successfully');
  });

  // ------------------------------- get all owners ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await ownerService.getAll(req.query);
    ApiResponse.paginated(res, items, pagination, 'Owners retrieved successfully');
  });

  // ------------------------------- get owners lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const items = await ownerService.getLookup();
    ApiResponse.success(res, items, 'Owners lookup retrieved');
  });

  // ------------------------------- get one owner ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await ownerService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Owner retrieved successfully');
  });

  // ------------------------------- update owner ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await ownerService.update(req.params.id, req.body);
    ApiResponse.success(res, item, 'Owner updated successfully');
  });

  // ------------------------------- delete owner ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await ownerService.delete(req.params.id);
    ApiResponse.success(res, null, result.message);
  });

  // ------------------------------- bulk delete owners ----------------------------
  bulkDelete = catchAsync(async (req, res) => {
    const ids = req.body?.ids || [];
    const result = await ownerService.bulkDelete(ids);
    ApiResponse.success(res, result, result.message);
  });
}

module.exports = new OwnerController();
