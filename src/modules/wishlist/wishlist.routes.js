const express = require('express');
const router = express.Router();
const wishlistController = require('./wishlist.controller');
const { optionalAuth } = require('../../middleware/auth.middleware');

// Optional authentication applies to all wishlist routes
// Allows both authenticated users and guest sessions to use wishlist
router.use(optionalAuth);

// Wishlist endpoints
router.get('/', wishlistController.getWishlist);
router.post('/toggle', wishlistController.toggleItem);
router.post('/add', wishlistController.addItem);
router.delete('/:productId', wishlistController.removeItem);
router.delete('/', wishlistController.clearWishlist);

module.exports = router;
