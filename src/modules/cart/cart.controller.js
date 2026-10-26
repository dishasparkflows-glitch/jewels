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

  // ------------------------------- get cart & wishlist counts ----------------------------
  getCounts = catchAsync(async (req, res) => {
    const { userId, sessionId } = this.getIdentity(req);
    const data = await cartService.getCounts({ userId, sessionId });
    ApiResponse.success(res, data, 'Counts retrieved successfully');
  });

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
      productId,
      quantity = 1,
      price,
      totalItemPrice,
      selectedMetal,
      selectedSize,
      selectedAttributes,
      userId,
      options,
      product,
    } = req.body;

    const effectiveUserId = authUserId || userId || null;
    const resolvedProductId = productId || product?.productId || product?.id || product?._id || options?.productId;
    const resolvedPrice = price !== undefined ? Number(price) : (options?.price !== undefined ? Number(options.price) : Number(product?.price || 0));
    const resolvedTotalItemPrice = totalItemPrice !== undefined ? Number(totalItemPrice) : (options?.totalItemPrice !== undefined ? Number(options.totalItemPrice) : resolvedPrice);
    const resolvedMetal = selectedMetal || options?.selectedMetal || product?.selectedMetal || '';
    const resolvedSize = selectedSize || options?.selectedSize || options?.size || product?.selectedSize || '';
    const rawAttributes = selectedAttributes || options?.selectedAttributes || product?.selectedAttributes || null;

    // Only keep selectedAttributes if it has non-null/non-empty values
    let resolvedAttributes = null;
    if (rawAttributes && typeof rawAttributes === 'object') {
      const hasNonNull = Object.values(rawAttributes).some((v) => v !== null && v !== undefined && v !== '');
      if (hasNonNull) {
        resolvedAttributes = rawAttributes;
      }
    }

    const data = await cartService.addToCart({
      userId: effectiveUserId,
      sessionId,
      productData: {
        productId: resolvedProductId,
        price: resolvedPrice,
        totalItemPrice: resolvedTotalItemPrice,
        selectedMetal: resolvedMetal,
        selectedSize: resolvedSize,
        selectedAttributes: resolvedAttributes,
      },
      quantity: Number(quantity) || 1,
      options: {
        selectedMetal: resolvedMetal,
        selectedSize: resolvedSize,
        selectedAttributes: resolvedAttributes,
      },
    });

    try {
      const { emitCartUpdate } = require('../../socket/viewers.socket');
      emitCartUpdate({
        userId: effectiveUserId,
        sessionId,
        totalItems: data.totalItems,
      });
    } catch {}

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

    try {
      const { emitCartUpdate } = require('../../socket/viewers.socket');
      emitCartUpdate({
        userId,
        sessionId,
        totalItems: data.totalItems,
      });
    } catch {}

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

    try {
      const { emitCartUpdate } = require('../../socket/viewers.socket');
      emitCartUpdate({
        userId,
        sessionId,
        totalItems: data.totalItems,
      });
    } catch {}

    ApiResponse.success(res, data, 'Item removed from cart');
  });

  // ------------------------------- clear cart ----------------------------
  clearCart = catchAsync(async (req, res) => {
    const { userId, sessionId } = this.getIdentity(req);
    const data = await cartService.clearCart({ userId, sessionId });

    try {
      const { emitCartUpdate } = require('../../socket/viewers.socket');
      emitCartUpdate({
        userId,
        sessionId,
        totalItems: 0,
      });
    } catch {}

    ApiResponse.success(res, data, 'Cart cleared successfully');
  });
}

module.exports = new CartController();
