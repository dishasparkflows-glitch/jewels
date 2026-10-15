const express = require('express');
const router = express.Router();
const wishlistController = require('./wishlist.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// All wishlist routes require authentication
router.use(authenticate);

// Wishlist endpoints
router.get('/', wishlistController.getWishlist);
router.post('/toggle', wishlistController.toggleItem);
router.post('/add', wishlistController.addItem);
router.delete('/:productId', wishlistController.removeItem);
router.delete('/', wishlistController.clearWishlist);

module.exports = router;
