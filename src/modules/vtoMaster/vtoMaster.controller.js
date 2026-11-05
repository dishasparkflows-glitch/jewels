const vtoMasterService = require('./vtoMaster.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class VTOMasterController {
  // ------------------------------- create vto master ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await vtoMasterService.create(req.body);
    await redisClient.deleteByPattern('vto-masters:*');
    ApiResponse.created(res, null, 'VTO configuration created successfully');
  });

  // ------------------------------- get all vto masters ----------------------------
  getAll = catchAsync(async (req, res) => {
    const { items, pagination } = await vtoMasterService.getAll(req.query);
    ApiResponse.paginated(
      res,
      items,
      pagination,
      'VTO configurations retrieved successfully'
    );
  });

  // ------------------------------- get vto master lookup ----------------------------
  getLookup = catchAsync(async (req, res) => {
    const cacheKey = `vto-masters:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => vtoMasterService.getLookup(req.query));
    ApiResponse.success(res, items, 'VTO lookup list retrieved');
  });

  // ------------------------------- get vto master by body part ----------------------------
  getByBodyPart = catchAsync(async (req, res) => {
    const item = await vtoMasterService.getByBodyPart(req.params.bodyPart);
    ApiResponse.success(res, item, 'VTO configuration retrieved successfully');
  });

  // ------------------------------- get one vto master ----------------------------
  getOne = catchAsync(async (req, res) => {
    const item = await vtoMasterService.getOne(req.params.id);
    ApiResponse.success(res, item, 'VTO configuration retrieved successfully');
  });

  // ------------------------------- update vto master ----------------------------
  update = catchAsync(async (req, res) => {
    const item = await vtoMasterService.update(req.params.id, req.body);
    await redisClient.deleteByPattern('vto-masters:*');
    ApiResponse.success(res, null, 'VTO configuration updated successfully');
  });

  // ------------------------------- delete vto master ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await vtoMasterService.delete(req.params.id);
    await redisClient.deleteByPattern('vto-masters:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new VTOMasterController();
