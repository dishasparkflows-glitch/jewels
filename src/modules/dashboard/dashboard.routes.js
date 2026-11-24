const express = require('express');
const router = express.Router();
const dashboardController = require('./dashboard.controller');
const analyticsController = require('../analytics/analytics.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// All dashboard endpoints require Admin or Super Admin authentication
router.use(authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router.get('/stats', dashboardController.getCounts);
router.get('/sales', analyticsController.getDashboardSalesMetrics);
router.get('/top-selling-products', dashboardController.getTopSellingProducts);
router.get('/recent-orders', dashboardController.getRecentOrders);

module.exports = router;
