const express = require('express');
const router = express.Router();
const wishlistController = require('./wishlist.controller');
const { authenticate, optionalAuth } = require('../../middleware/auth.middleware');

// Public count endpoint (handles optional auth)
router.get('/counts', optionalAuth, wishlistController.getCounts);

// All other wishlist routes require authentication
router.use(authenticate);

// Wishlist endpoints
router.get('/', wishlistController.getWishlist);
router.post('/toggle', wishlistController.toggleItem);
router.post('/add', wishlistController.addItem);
router.delete('/:productId', wishlistController.removeItem);
router.delete('/', wishlistController.clearWishlist);

module.exports = router;
