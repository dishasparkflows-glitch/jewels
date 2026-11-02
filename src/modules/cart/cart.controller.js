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
    } = req.body;

    const effectiveUserId = authUserId || userId || null;
    const resolvedProductId = productId || options?.productId;
    const resolvedPrice = price !== undefined ? Number(price) : (options?.price !== undefined ? Number(options.price) : 0);
    const resolvedTotalItemPrice = totalItemPrice !== undefined ? Number(totalItemPrice) : (options?.totalItemPrice !== undefined ? Number(options.totalItemPrice) : resolvedPrice);
    const resolvedMetal = selectedMetal || options?.selectedMetal || '';
    const resolvedSize = selectedSize || options?.selectedSize || options?.size || '';
    const rawAttributes = selectedAttributes || options?.selectedAttributes || null;

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

    ApiResponse.success(res, data, 'Cart quantity updated');
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
