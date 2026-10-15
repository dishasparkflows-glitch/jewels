const centerDiamondPriceService = require('./centerDiamondPrice.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const { importDiamondPriceWorkbook } = require('../../utils/diamondPriceExcelImport');

class CenterDiamondPriceController {
  // ------------------------------- create center diamond price ----------------------------
  create = catchAsync(async (req, res) => {
    if (req.user && req.user._id) {
      req.body.updatedBy = req.user._id;
    }
    const item = await centerDiamondPriceService.create(req.body);
    ApiResponse.created(res, item, 'Center diamond price created successfully');
  });

  // ------------------------------- get all center diamond prices ----------------------------

  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await centerDiamondPriceService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Center diamond prices retrieved successfully'
    );
  });

  // ------------------------------- get center diamond price lookup ----------------------------

  getLookup = catchAsync(async (req, res) => {
    const items = await centerDiamondPriceService.getLookup(req.query);
    ApiResponse.success(res, items, 'Center diamond price lookup list retrieved');
  });

  // ------------------------------- get one center diamond price ----------------------------

  getOne = catchAsync(async (req, res) => {
    const item = await centerDiamondPriceService.getOne(req.params.id);
    ApiResponse.success(res, item, 'Center diamond price retrieved successfully');
  });

  // ------------------------------- update center diamond price ----------------------------

  update = catchAsync(async (req, res) => {
    if (req.user && req.user._id) {
      req.body.updatedBy = req.user._id;
    }
    const item = await centerDiamondPriceService.update(req.params.id, req.body);
    ApiResponse.success(res, item, 'Center diamond price updated successfully');
  });

  // Import an Excel workbook and persist its rows through the existing upsert service.
  importExcel = catchAsync(async (req, res) => {
    const items = await importDiamondPriceWorkbook({
      buffer: req.body,
      filename: req.headers['x-file-name'] || req.query.filename || '',
      diamondTypeId: req.query.diamondTypeId || req.body?.diamondTypeId,
      userId: req.user?._id || null,
    });
    const result = await centerDiamondPriceService.bulkSave(items, req.user?._id || null);
    ApiResponse.success(res, result, 'Center diamond prices imported successfully');
  });

  // ------------------------------- bulk save center diamond prices ------------------------

  bulkSave = catchAsync(async (req, res) => {
    const userId = req.user?._id || null;
    const items = req.body?.items || req.body;
    const result = await centerDiamondPriceService.bulkSave(items, userId);
    ApiResponse.success(res, result, 'Center diamond prices saved successfully');
  });

  // ------------------------------- delete center diamond price ----------------------------

  delete = catchAsync(async (req, res) => {
    const result = await centerDiamondPriceService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new CenterDiamondPriceController();
