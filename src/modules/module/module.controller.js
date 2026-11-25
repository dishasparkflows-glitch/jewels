const moduleService = require('./module.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class ModuleController {
  // ------------------------------- get all modules ----------------------------
  getAll = catchAsync(async (req, res) => {
    const items = await moduleService.getAll(req.query);
    ApiResponse.success(res, items, 'Modules retrieved successfully');
  });

  // ------------------------------- get modules lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const items = await moduleService.getLookup(req.query);
    ApiResponse.success(res, items, 'Modules lookup retrieved');
  });

  // ------------------------------- sync local modules ----------------------------
  sync = catchAsync(async (req, res) => {
    const items = await moduleService.ensureLocalModulesSeeded();
    ApiResponse.success(res, items, 'Modules synced successfully');
  });

  // ------------------------------- update module status ----------------------------
  updateStatus = catchAsync(async (req, res) => {
    const item = await moduleService.updateStatus(req.params.id, req.body?.status);
    ApiResponse.success(res, item, 'Module status updated successfully');
  });
}

module.exports = new ModuleController();
