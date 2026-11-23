const ornateService = require('./ornate.service');
const ornateCron = require('./ornate.cron');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class OrnateController {
  // ------------------------------- test ornate connection ----------------------------
  testConnection = catchAsync(async (req, res) => {
    const result = await ornateService.testOrnateConnection();
    if (result.success) {
      ApiResponse.success(res, result, result.message);
    } else {
      ApiResponse.error(res, result.error, 502, result);
    }
  });

  // ------------------------------- get ornate sync status ----------------------------
  getStatus = catchAsync(async (req, res) => {
    const status = ornateCron.getOrnateSyncStatus();
    const imageSync = ornateService.getImageSyncStatus();
    ApiResponse.success(res, { ...status, imageSync }, 'Ornate sync status retrieved');
  });

  // ------------------------------- trigger ornate full sync ----------------------------
  triggerFullSync = catchAsync(async (req, res) => {
    const result = await ornateCron.triggerOrnateSync('manual_admin_request', req.user?._id);
    if (result.skipped) {
      return ApiResponse.success(res, result, 'Sync already in progress');
    }
    if (result.success) {
      ApiResponse.success(res, result.result, 'Ornate Full Sync completed successfully');
    } else {
      res.status(500).json({ success: false, message: result.error, data: result.result });
    }
  });

  // ------------------------------- sync ornate labels ----------------------------
  syncLabels = catchAsync(async (req, res) => {
    const { sessionId, categories, productIds } = req.body || {};
    const options = (categories || productIds) ? { categories, productIds } : null;
    const result = await ornateService.syncOrnateLabels(sessionId, options, req.user?._id);
    if (!result.success) return res.status(500).json({ success: false, message: 'Ornate label sync failed for one or more records', data: result });
    const msg = result.queuedImagesCount > 0
      ? `Successfully synced ${result.count || 0} products from Ornate ERP (${result.queuedImagesCount} images syncing in background)`
      : `Successfully synced ${result.count || 0} products from Ornate ERP`;
    ApiResponse.success(res, result, msg);
  });

  // ------------------------------- sync ornate sold labels ----------------------------
  syncSold = catchAsync(async (req, res) => {
    const result = await ornateService.syncOrnateSoldLabels(undefined, req.user?._id);
    ApiResponse.success(res, result, result.message || 'Sold labels sync complete');
  });

  // ------------------------------- sync specific sold labels ----------------------------
  syncSelectedSold = catchAsync(async (req, res) => {
    const { productIds } = req.body || {};
    const result = await ornateService.syncSpecificSoldLabels(productIds, req.user?._id);
    ApiResponse.success(res, result, result.message);
  });

  // ------------------------------- sync ornate metal rates ----------------------------
  syncMetalRates = catchAsync(async (req, res) => {
    const result = await ornateService.syncOrnateMetalRateChanges(req.user?._id);
    if (!result.success) return res.status(500).json({ success: false, message: 'Ornate metal rate sync failed for one or more records', data: result });
    ApiResponse.success(res, result, `Updated metal rates for ${result.count || 0} products`);
  });

  // ------------------------------- get ornate erp categories ----------------------------
  getCategories = catchAsync(async (req, res) => {
    const result = await ornateService.getOrnateErpCategories();
    ApiResponse.success(res, result, 'Ornate ERP categories retrieved');
  });

  // ------------------------------- get ornate erp sold labels ----------------------------
  getSoldLabels = catchAsync(async (req, res) => {
    const result = await ornateService.getOrnateErpSoldLabels();
    ApiResponse.success(res, result, 'Ornate ERP sold items retrieved');
  });
}

module.exports = new OrnateController();
