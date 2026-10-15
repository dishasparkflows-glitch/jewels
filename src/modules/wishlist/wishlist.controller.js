const wishlistService = require('./wishlist.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

class WishlistController {
  // ------------------------------- get wishlist ----------------------------
  getWishlist = catchAsync(async (req, res) => {
    const data = await wishlistService.getWishlist(req.user._id);
    ApiResponse.success(res, data, 'Wishlist retrieved successfully');
  });

  // ------------------------------- toggle item in wishlist ----------------------------
  toggleItem = catchAsync(async (req, res) => {
    const result = await wishlistService.toggleItem({
      userId: req.user._id,
      productData: req.body,
    });

    const msg = result.isWishlisted
      ? 'Item added to wishlist'
      : 'Item removed from wishlist';

    ApiResponse.success(res, result, msg);
  });

  // ------------------------------- add item to wishlist ----------------------------
  addItem = catchAsync(async (req, res) => {
    const result = await wishlistService.addItem({
      userId: req.user._id,
      productData: req.body,
    });
    ApiResponse.success(res, result, 'Item added to wishlist');
  });

  // ------------------------------- remove item from wishlist ----------------------------
  removeItem = catchAsync(async (req, res) => {
    const { productId } = req.params;
    const result = await wishlistService.removeItem({
      userId: req.user._id,
      productId,
    });
    ApiResponse.success(res, result, 'Item removed from wishlist');
  });

  // ------------------------------- clear wishlist ----------------------------
  clearWishlist = catchAsync(async (req, res) => {
    const result = await wishlistService.clearWishlist(req.user._id);
    ApiResponse.success(res, result, 'Wishlist cleared successfully');
  });
}

module.exports = new WishlistController();
