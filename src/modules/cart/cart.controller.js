const cartService = require('./cart.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class CartController {
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

  // ------------------------------- get cart ----------------------------
  getCart = catchAsync(async (req, res) => {
    const { userId, sessionId } = this.getIdentity(req);
    const data = await cartService.getCart({ userId, sessionId });
    ApiResponse.success(res, data, 'Cart retrieved successfully');
  });

  // ------------------------------- add to cart ----------------------------
  addToCart = catchAsync(async (req, res) => {
    const { userId: authUserId, sessionId } = this.getIdentity(req);
    const {
      product,
      quantity = 1,
      options = {},
      userId,
      productId,
      addedAt,
      price,
      totalItemPrice,
      selectedAttributes,
    } = req.body;

    const effectiveUserId = userId || authUserId || null;

    // Accept either product object or flat fields
    const productData = {
      ...(typeof product === 'object' && product !== null ? product : {}),
      ...(productId ? { productId } : {}),
      ...(addedAt ? { addedAt } : {}),
      ...(price !== undefined ? { price } : {}),
      ...(totalItemPrice !== undefined ? { totalItemPrice } : {}),
      ...(selectedAttributes ? { selectedAttributes } : {}),
      ...(!product ? req.body : {}),
    };

    const data = await cartService.addToCart({
      userId: effectiveUserId,
      sessionId,
      productData,
      quantity: quantity || productData.quantity || 1,
      options: {
        ...options,
        ...(selectedAttributes ? { selectedAttributes } : {}),
      },
    });

    ApiResponse.success(res, data, 'Item added to cart successfully');
  });

  // ------------------------------- update quantity ----------------------------
  updateQuantity = catchAsync(async (req, res) => {
    const { userId, sessionId } = this.getIdentity(req);
    const { productId, quantity, options } = req.body;

    const data = await cartService.updateQuantity({
      userId,
      sessionId,
      productId: productId || req.params.productId,
      quantity,
      options,
    });

    ApiResponse.success(res, data, 'Cart quantity updated');
  });

  // ------------------------------- remove item ----------------------------
  removeItem = catchAsync(async (req, res) => {
    const { userId, sessionId } = this.getIdentity(req);
    const { productId } = req.params;

    const data = await cartService.removeItem({
      userId,
      sessionId,
      productId,
    });

    ApiResponse.success(res, data, 'Item removed from cart');
  });

  // ------------------------------- clear cart ----------------------------
  clearCart = catchAsync(async (req, res) => {
    const { userId, sessionId } = this.getIdentity(req);
    const data = await cartService.clearCart({ userId, sessionId });
    ApiResponse.success(res, data, 'Cart cleared successfully');
  });
}

module.exports = new CartController();
