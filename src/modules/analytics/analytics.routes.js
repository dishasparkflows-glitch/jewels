const express = require('express');
const router = express.Router();
const analyticsController = require('./analytics.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Protect all analytics endpoints for Admin & Super Admin
router.use(authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router.get('/status', analyticsController.getStatus);
router.get('/dashboard', analyticsController.getDashboardAll);
router.get('/overview', analyticsController.getOverview);
router.get('/timeline', analyticsController.getTimeline);
router.get('/top-products', analyticsController.getTopProducts);
router.get('/traffic-sources', analyticsController.getTrafficSources);
router.get('/realtime', analyticsController.getRealtime);

module.exports = router;
