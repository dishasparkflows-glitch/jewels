const cartService = require('./cart.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const { emitCartUpdate } = require('../../socket/viewers.socket');

class CartController {
  // Helper to extract user identity
  getIdentity(req) {
    const userId = req.user?._id || req.body?.userId || req.query?.userId || null;
    return { userId };
  }

  // ------------------------------- get cart & wishlist counts ----------------------------
  getCounts = catchAsync(async (req, res) => {
    const { userId } = this.getIdentity(req);
    const data = await cartService.getCounts({ userId });
    ApiResponse.success(res, data, 'Counts retrieved successfully');
  });

  // ------------------------------- get cart ----------------------------
  getCart = catchAsync(async (req, res) => {
    const { userId } = this.getIdentity(req);
    const data = await cartService.getCart({ userId });
    ApiResponse.success(res, data, 'Cart retrieved successfully');
  });

  // ------------------------------- add to cart ----------------------------
  addToCart = catchAsync(async (req, res) => {
    const { userId: authUserId } = this.getIdentity(req);
    const effectiveUserId = authUserId || req.body?.userId || null;

    const data = await cartService.addToCart({
      userId: effectiveUserId,
      ...req.body,
    });

    try {
      emitCartUpdate({
        userId: effectiveUserId,
        totalItems: data.totalItems,
      });
    } catch {}

    ApiResponse.success(res, data, 'Item added to cart successfully');
  });

  // ------------------------------- update quantity ----------------------------
  updateQuantity = catchAsync(async (req, res) => {
    const { userId } = this.getIdentity(req);
    const { productId, quantity, options } = req.body;

    const data = await cartService.updateQuantity({
      userId,
      productId: productId || req.params.productId,
      quantity,
      options,
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
    const { productId } = req.params;

    const data = await cartService.removeItem({
      userId,
      productId,
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
