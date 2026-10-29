const express = require('express');
const router = express.Router();
const orderController = require('./order.controller');
const { authenticate, authorize, optionalAuth } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public / Guest / Customer checkout
router.post('/', optionalAuth, orderController.createOrder);

// User orders list (protected)
router.get('/my-orders', authenticate, orderController.getMyOrders);

// Order lookup by order number (e.g. tracking page / order confirmation)
router.get('/lookup/:orderNumber', optionalAuth, orderController.getOrderByNumber);

// Get single order by ID
router.get('/:id', optionalAuth, orderController.getOrderById);

// Cancel order
router.post('/:id/cancel', optionalAuth, orderController.cancelOrder);

// Admin endpoints
router.get(
  '/',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  orderController.getAllOrders
);

router.patch(
  '/:id/status',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  orderController.updateOrderStatus
);

module.exports = router;

