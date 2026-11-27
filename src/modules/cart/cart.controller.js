const cartService = require('./cart.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const { emitCartUpdate } = require('../../socket/viewers.socket');

class CartController {
  // Helper to extract authenticated user identity only (never trust client-supplied userId)
  getIdentity(req) {
    const userId = req.user?._id || null;
    return { userId };
  }

  // ------------------------------- get cart & wishlist counts ----------------------------
  getCounts = catchAsync(async (req, res) => {
    const userId = req.user?._id || null;
    const userEmail = req.user?.auth?.email || req.user?.email || null;
    const data = await cartService.getCounts({ userId, userEmail });
    ApiResponse.success(res, data, 'Counts retrieved successfully');
  });

  // ------------------------------- get cart ----------------------------
  getCart = catchAsync(async (req, res) => {
    const { userId } = this.getIdentity(req);
    const data = await cartService.getCart({ userId });
    ApiResponse.success(res, data, 'Cart retrieved successfully');
  });

  // ------------------------------- merge guest cart ----------------------------
  mergeCart = catchAsync(async (req, res) => {
    const userId = req.user?._id;
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const data = await cartService.mergeCart({ userId, items });

    try {
      emitCartUpdate({
        userId,
        totalItems: data.totalItems,
      });
    } catch {}

    ApiResponse.success(res, data, 'Cart merged successfully');
  });

  // ------------------------------- add to cart ----------------------------
  addToCart = catchAsync(async (req, res) => {
    const { userId } = this.getIdentity(req);
    const { userId: _ignoredUserId, ...itemPayload } = req.body || {};

    const data = await cartService.addToCart({
      ...itemPayload,
      userId,
    });

    try {
      emitCartUpdate({
        userId,
        totalItems: data.totalItems,
      });
    } catch {}

    ApiResponse.success(res, data, 'Item added to cart successfully');
  });

  // ------------------------------- update quantity ----------------------------
  updateQuantity = catchAsync(async (req, res) => {
    const { userId } = this.getIdentity(req);
    const { refId, quantity } = req.body;

    const data = await cartService.updateQuantity({
      userId,
      refId,
      quantity,
    });

    try {
      emitCartUpdate({
        userId,
        totalItems: data.totalItems,
      });
    } catch {}

    ApiResponse.success(res, null, 'Cart quantity updated');
  });

  // ------------------------------- remove item ----------------------------
  removeItem = catchAsync(async (req, res) => {
    const { userId } = this.getIdentity(req);
    const { refId } = req.params;

    const data = await cartService.removeItem({
      userId,
      refId,
    });

    try {
      emitCartUpdate({
        userId,
        totalItems: data.totalItems,
      });
    } catch {}

    ApiResponse.success(res, data, 'Item removed from cart');
  });

  // ------------------------------- clear cart ----------------------------
  clearCart = catchAsync(async (req, res) => {
    const { userId } = this.getIdentity(req);
    const data = await cartService.clearCart({ userId });

    try {
      emitCartUpdate({
        userId,
        totalItems: 0,
      });
    } catch {}

    ApiResponse.success(res, data, 'Cart cleared successfully');
  });
}

module.exports = new CartController();
