const instagramPostService = require('./instagramPost.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const redisClient = require('../../utils/redisClient');
const { CACHE_TTL } = require('../../config/constants');

class InstagramPostController {
  // ------------------------------- create instagram post ----------------------------
  create = catchAsync(async (req, res) => {
    const item = await instagramPostService.create(req.body);
    await redisClient.deleteByPattern('instagram-posts:*');
    ApiResponse.created(res, null, 'Instagram post created successfully');
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
    const cacheKey = `instagram-posts:lookup:${Object.keys(req.query || {}).length ? JSON.stringify(req.query) : 'all'}`;
    const items = await redisClient.getOrSet(cacheKey, CACHE_TTL, () => instagramPostService.getLookup(req.query));
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
    await redisClient.deleteByPattern('instagram-posts:*');
    ApiResponse.success(res, null, 'Instagram post updated successfully');
  });

  // ------------------------------- reorder instagram posts ----------------------------
  reorder = catchAsync(async (req, res) => {
    const result = await instagramPostService.reorder(req.body.items);
    await redisClient.deleteByPattern('instagram-posts:*');
    ApiResponse.success(res, null, 'Instagram posts reordered successfully');
  });

  // ------------------------------- delete instagram post ----------------------------
  delete = catchAsync(async (req, res) => {
    const result = await instagramPostService.delete(req.params.id);
    await redisClient.deleteByPattern('instagram-posts:*');
    ApiResponse.success(res, null, result.message);
  });

  // ------------------------------- bulk delete instagram posts ----------------------------
  bulkDelete = catchAsync(async (req, res) => {
    const { ids } = req.body;
    const result = await instagramPostService.bulkDelete(ids);
    await redisClient.deleteByPattern('instagram-posts:*');
    ApiResponse.success(res, null, result.message);
  });
}

module.exports = new InstagramPostController();
