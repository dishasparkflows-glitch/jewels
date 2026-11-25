const express = require('express');
const router = express.Router();
const cartController = require('./cart.controller');
const { authenticate, optionalAuth } = require('../../middleware/auth.middleware');

// Apply optionalAuth so guest visitors and authenticated users can use the cart
router.use(optionalAuth);

router.get('/counts', cartController.getCounts);
router.get('/', cartController.getCart);
router.post('/merge', authenticate, cartController.mergeCart);
router.post('/add', cartController.addToCart);
router.put('/quantity', cartController.updateQuantity);
router.delete('/:refId', cartController.removeItem);
router.delete('/', cartController.clearCart);

module.exports = router;
