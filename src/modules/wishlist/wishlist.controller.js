const wishlistService = require('./wishlist.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const { emitWishlistUpdate } = require('../../socket/viewers.socket');

class WishlistController {
  // ------------------------------- get count ----------------------------
  getCounts = catchAsync(async (req, res) => {
    const data = await wishlistService.getCount(req.user?._id);
    ApiResponse.success(res, data, 'Wishlist count retrieved');
  });

  // ------------------------------- get wishlist ----------------------------
  getWishlist = catchAsync(async (req, res) => {
    const data = await wishlistService.getWishlist(req.user._id);
    ApiResponse.success(res, data, 'Wishlist retrieved successfully');
  });

  // ------------------------------- toggle item in wishlist ----------------------------
  toggleItem = catchAsync(async (req, res) => {
    const { refId, itemType } = req.body || {};
    const result = await wishlistService.toggleItem({
      userId: req.user._id,
      refId,
      itemType,
    });

    const msg = result.isWishlisted
      ? 'Item added to wishlist'
      : 'Item removed from wishlist';

    try {
      emitWishlistUpdate({
        userId: req.user._id,
        wishlistCount: result.wishlistCount || 0,
        refId: result.refId,
        itemType: result.itemType,
        isWishlisted: result.isWishlisted,
      });
    } catch {}

    ApiResponse.success(res, result, msg);
  });

  // ------------------------------- merge guest wishlist ----------------------------
  mergeWishlist = catchAsync(async (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const result = await wishlistService.mergeWishlist({
      userId: req.user._id,
      items,
    });

    try {
      emitWishlistUpdate({
        userId: req.user._id,
        wishlistCount: result?.items?.length || 0,
        isWishlisted: true,
      });
    } catch {}

    ApiResponse.success(res, result, 'Wishlist merged successfully');
  });

  // ------------------------------- add item to wishlist ----------------------------
  addItem = catchAsync(async (req, res) => {
    const { refId, itemType } = req.body || {};
    const result = await wishlistService.addItem({
      userId: req.user._id,
      refId,
      itemType,
    });

    try {
      emitWishlistUpdate({
        userId: req.user._id,
        wishlistCount: result.items?.length || 0,
        refId,
        itemType,
        isWishlisted: true,
      });
    } catch {}

    ApiResponse.success(res, result, 'Item added to wishlist');
  });

  // ------------------------------- remove item from wishlist ----------------------------
  removeItem = catchAsync(async (req, res) => {
    const { refId } = req.params;
    const result = await wishlistService.removeItem({
      userId: req.user._id,
      refId,
    });

    try {
      emitWishlistUpdate({
        userId: req.user._id,
        wishlistCount: result.items?.length || 0,
        refId,
        isWishlisted: false,
      });
    } catch {}

    ApiResponse.success(res, result, 'Item removed from wishlist');
  });

  // ------------------------------- clear wishlist ----------------------------
  clearWishlist = catchAsync(async (req, res) => {
    const result = await wishlistService.clearWishlist(req.user._id);

    try {
      emitWishlistUpdate({
        userId: req.user._id,
        wishlistCount: 0,
        isWishlisted: false,
      });
    } catch {}

    ApiResponse.success(res, result, 'Wishlist cleared successfully');
  });
}

module.exports = new WishlistController();
