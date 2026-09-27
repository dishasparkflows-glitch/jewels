const wishlistService = require('./wishlist.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class WishlistController {
  // Helper to extract user identity or session
  getIdentity(req) {
    const userId = req.user?._id || null;
    const sessionId =
      req.headers['x-session-id'] ||
      req.query.sessionId ||
      req.body.sessionId ||
      null;

    return { userId, sessionId };
  }

  // ------------------------------- get wishlist ----------------------------
  getWishlist = catchAsync(async (req, res) => {
    const { userId, sessionId } = this.getIdentity(req);
    const data = await wishlistService.getWishlist({ userId, sessionId });
    ApiResponse.success(res, data, 'Wishlist retrieved successfully');
  });

  // ------------------------------- toggle item in wishlist ----------------------------
  toggleItem = catchAsync(async (req, res) => {
    const { userId, sessionId } = this.getIdentity(req);
    const productData = req.body;
    const result = await wishlistService.toggleItem({
      userId,
      sessionId,
      productData,
    });

    const msg = result.isWishlisted
      ? 'Item added to wishlist'
      : 'Item removed from wishlist';

    ApiResponse.success(res, result, msg);
  });

  // ------------------------------- add item to wishlist ----------------------------
  addItem = catchAsync(async (req, res) => {
    const { userId, sessionId } = this.getIdentity(req);
    const result = await wishlistService.addItem({
      userId,
      sessionId,
      productData: req.body,
    });
    ApiResponse.success(res, result, 'Item added to wishlist');
  });

  // ------------------------------- remove item from wishlist ----------------------------
  removeItem = catchAsync(async (req, res) => {
    const { userId, sessionId } = this.getIdentity(req);
    const { productId } = req.params;
    const result = await wishlistService.removeItem({
      userId,
      sessionId,
      productId,
    });
    ApiResponse.success(res, result, 'Item removed from wishlist');
  });

  // ------------------------------- clear wishlist ----------------------------
  clearWishlist = catchAsync(async (req, res) => {
    const { userId, sessionId } = this.getIdentity(req);
    const result = await wishlistService.clearWishlist({ userId, sessionId });
    ApiResponse.success(res, result, 'Wishlist cleared successfully');
  });
}

module.exports = new WishlistController();
