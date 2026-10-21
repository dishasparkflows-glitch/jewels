const productGroupService = require('./productGroup.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class ProductGroupController {
  getTabCounts = catchAsync(async (req, res) => {
    const counts = await productGroupService.getTabCounts();
    ApiResponse.success(res, counts, 'Tab counts retrieved successfully');
  });

  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await productGroupService.getGroups(req.query);
    ApiResponse.paginated(res, items, pagination, 'Product groups retrieved successfully');
  });

  getSummary = catchAsync(async (req, res) => {
    const { items, pagination } = await productGroupService.getGroupsSummary(req.query);
    ApiResponse.paginated(res, items, pagination, 'Product groups summary retrieved successfully');
  });

  getOne = catchAsync(async (req, res) => {
    const group = await productGroupService.getGroupById(req.params.id);
    ApiResponse.success(res, group, 'Product group retrieved successfully');
  });

  create = catchAsync(async (req, res) => {
    const group = await productGroupService.createGroup(req.body, req.user?._id);
    ApiResponse.created(res, group, 'Product group created successfully');
  });

  update = catchAsync(async (req, res) => {
    const group = await productGroupService.updateGroup(req.params.id, req.body, req.user?._id);
    ApiResponse.success(res, group, 'Product group updated successfully');
  });

  delete = catchAsync(async (req, res) => {
    const result = await productGroupService.deleteGroup(req.params.id, req.user?._id);
    ApiResponse.success(res, { id: result.id }, result.message);
  });

  addProducts = catchAsync(async (req, res) => {
    const group = await productGroupService.addProducts(
      req.params.id,
      req.body.productIds,
      req.user?._id
    );
    ApiResponse.success(res, group, 'Products added to group successfully');
  });

  removeProduct = catchAsync(async (req, res) => {
    const group = await productGroupService.removeProduct(
      req.params.id,
      req.params.productId,
      req.user?._id
    );
    ApiResponse.success(res, group, 'Product removed from group successfully');
  });

  moveProducts = catchAsync(async (req, res) => {
    const result = await productGroupService.moveProducts({
      sourceGroupId: req.params.id || req.body.sourceGroupId,
      targetGroupId: req.body.targetGroupId || req.body.target,
      newGroupName: req.body.newGroupName,
      productIds: req.body.productIds,
      userId: req.user?._id,
    });
    ApiResponse.success(res, result, result.message);
  });

  approveGroup = catchAsync(async (req, res) => {
    const result = await productGroupService.approveGroup(
      req.params.id,
      req.body.productIds,
      req.user?._id
    );
    ApiResponse.success(res, result, result.message);
  });

  getUngrouped = catchAsync(async (req, res) => {
    const { items, pagination } = await productGroupService.getUngroupedProducts(req.query);
    ApiResponse.paginated(res, items, pagination, 'Ungrouped products retrieved successfully');
  });

  previewSync = catchAsync(async (req, res) => {
    const preview = await productGroupService.previewSync({
      groupId: req.params.id || req.body.groupId,
      sourceProductId: req.body.sourceProductId || req.body.sourceId,
      targetProductIds: req.body.targetProductIds || req.body.productIds,
      fields: req.body.fields,
    });
    ApiResponse.success(res, preview, 'Sync preview generated successfully');
  });

  executeSync = catchAsync(async (req, res) => {
    const result = await productGroupService.executeSync({
      groupId: req.params.id || req.body.groupId,
      sourceProductId: req.body.sourceProductId || req.body.sourceId,
      targetProductIds: req.body.targetProductIds || req.body.productIds,
      fields: req.body.fields,
      userId: req.user?._id,
    });
    ApiResponse.success(res, result, result.message);
  });
}

module.exports = new ProductGroupController();
