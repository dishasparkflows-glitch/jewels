const express = require('express');
const router = express.Router();
const logisticsController = require('./logistics.controller');
const { authenticate, authorize, optionalAuth } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// ─── Public / Customer Tracking & Serviceability Endpoints ─────────────────

// GET /api/logistics/config
router.get('/config', logisticsController.getConfig);

// GET /api/logistics/serviceability
router.get('/serviceability', logisticsController.checkServiceability);

// GET /api/logistics/track/awb/:awbCode
router.get('/track/awb/:awbCode', logisticsController.trackByAwb);

// GET /api/logistics/track/order/:orderId
router.get('/track/order/:orderId', optionalAuth, logisticsController.trackByOrderId);

// POST /api/logistics/webhook (Carrier scan event listener)
router.post('/webhook', logisticsController.handleWebhook);

// ─── Protected Logistics Operations (Admin / Ops) ──────────────────────────
router.use(authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router.get('/rates/:orderId', logisticsController.getCourierRates);
router.post('/create-shipment/:orderId', logisticsController.createShipment);
router.post('/assign-awb/:orderId', logisticsController.assignAwb);
router.get('/label/:orderId', logisticsController.getLabel);
router.get('/manifest/:orderId', logisticsController.getManifest);
router.get('/track/:orderId', logisticsController.trackAdminOrder);
router.post('/create-return-shipment/:returnId', logisticsController.createReturnShipment);
router.get('/return-label/:returnId', logisticsController.getReturnLabel);
router.get('/track-return/:returnId', logisticsController.trackReturn);
router.post('/cancel', logisticsController.cancelShipment);

module.exports = router;
