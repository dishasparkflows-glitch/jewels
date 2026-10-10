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
    ApiResponse.success(res, status, 'Ornate sync status retrieved');
  });

  // ------------------------------- trigger ornate full sync ----------------------------
  triggerFullSync = catchAsync(async (req, res) => {
    const result = await ornateCron.triggerOrnateSync('manual_admin_request');
    if (result.skipped) {
      return ApiResponse.success(res, result, 'Sync already in progress');
    }
    if (result.success) {
      ApiResponse.success(res, result.result, 'Ornate Full Sync completed successfully');
    } else {
      ApiResponse.error(res, result.error, 500);
    }
  });

  // ------------------------------- sync ornate labels ----------------------------
  syncLabels = catchAsync(async (req, res) => {
    const { sessionId, categories, productIds } = req.body || {};
    const options = (categories || productIds) ? { categories, productIds } : null;
    const result = await ornateService.syncOrnateLabels(sessionId, options);
    ApiResponse.success(res, result, `Synced ${result.count || 0} labels from Ornate ERP`);
  });

  // ------------------------------- sync ornate sold labels ----------------------------
  syncSold = catchAsync(async (req, res) => {
    const result = await ornateService.syncOrnateSoldLabels();
    ApiResponse.success(res, result, result.message || 'Sold labels sync complete');
  });

  // ------------------------------- sync specific sold labels ----------------------------
  syncSelectedSold = catchAsync(async (req, res) => {
    const { productIds } = req.body || {};
    const result = await ornateService.syncSpecificSoldLabels(productIds);
    ApiResponse.success(res, result, result.message);
  });

  // ------------------------------- sync ornate metal rates ----------------------------
  syncMetalRates = catchAsync(async (req, res) => {
    const result = await ornateService.syncOrnateMetalRateChanges();
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
