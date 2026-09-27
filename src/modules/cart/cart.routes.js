const express = require('express');
const router = express.Router();
const cartController = require('./cart.controller');
const { optionalAuth } = require('../../middleware/auth.middleware');

// Apply optionalAuth so guest visitors and authenticated users can use the cart
router.use(optionalAuth);

router.get('/', cartController.getCart);
router.post('/add', cartController.addToCart);
router.post('/', cartController.addToCart);
router.patch('/quantity', cartController.updateQuantity);
router.put('/quantity', cartController.updateQuantity);
router.delete('/item/:productId', cartController.removeItem);
router.delete('/:productId', cartController.removeItem);
router.delete('/', cartController.clearCart);

module.exports = router;
