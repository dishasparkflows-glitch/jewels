const custJewelleryBeforeAfterService = require('./custJewelleryBeforeAfter.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class CustJewelleryBeforeAfterController {
  // ------------------------------- create cust jewellery before after ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await custJewelleryBeforeAfterService.create(req.body);
    ApiResponse.created(
      res,
      item,
      'Before/After showcase entry created successfully'
    );
  });

  // ------------------------------- get all cust jewellery before after ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } =
      await custJewelleryBeforeAfterService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'Before/After showcase entries retrieved successfully'
    );
  });

  // ------------------------------- get cust jewellery before after lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const items = await custJewelleryBeforeAfterService.getLookup(req.query);
    ApiResponse.success(
      res,
      items,
      'Before/After showcase lookup list retrieved'
    );
  });

  // ------------------------------- get one cust jewellery before after ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await custJewelleryBeforeAfterService.getOne(req.params.id);
    ApiResponse.success(
      res,
      item,
      'Before/After showcase entry retrieved successfully'
    );
  });

  // ------------------------------- update cust jewellery before after ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await custJewelleryBeforeAfterService.update(
      req.params.id,
      req.body
    );
    ApiResponse.success(
      res,
      item,
      'Before/After showcase entry updated successfully'
    );
  });

  // ------------------------------- delete cust jewellery before after ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await custJewelleryBeforeAfterService.delete(req.params.id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });
}

module.exports = new CustJewelleryBeforeAfterController();
