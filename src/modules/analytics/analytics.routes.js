const express = require('express');
const router = express.Router();
const analyticsController = require('./analytics.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Direct dev / Postman verification test endpoints
router.get('/test', analyticsController.getOverview);
router.route('/google-token').get(analyticsController.getGoogleAccessToken).post(analyticsController.getGoogleAccessToken);

// All other analytics endpoints require Admin or Super Admin authentication
router.use(authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router.get('/health', analyticsController.getAnalyticsHealth);
router.get('/status', analyticsController.getStatus);
router.get('/overview', analyticsController.getOverview);
router.get('/dashboard', analyticsController.getDashboardAll);

// GA4 Product Activity & Lead Reports
router.get('/products/add-to-cart', analyticsController.getProductsAddToCartReport);
router.get('/products/wishlist', analyticsController.getProductsWishlistReport);

module.exports = router;
