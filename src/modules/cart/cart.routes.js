const express = require('express');
const router = express.Router();
const cartController = require('./cart.controller');
const { authenticate, optionalAuth } = require('../../middleware/auth.middleware');

// Counts check uses optionalAuth and reads req.user._id strictly (never body/query userId)
router.get('/counts', optionalAuth, cartController.getCounts);

// All persisted cart operations require authentication
router.use(authenticate);

router.get('/', cartController.getCart);
router.post('/merge', cartController.mergeCart);
router.post('/add', cartController.addToCart);
router.put('/quantity', cartController.updateQuantity);
router.delete('/:refId', cartController.removeItem);
router.delete('/', cartController.clearCart);

module.exports = router;
