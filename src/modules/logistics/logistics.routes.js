const express = require('express');
const router = express.Router();
const logisticsController = require('./logistics.controller');
const { authenticate, optionalAuth } = require('../../middleware/auth.middleware');

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

router.get('/rates/:orderId', authenticate, logisticsController.getCourierRates);
router.post('/create-shipment/:orderId', authenticate, logisticsController.createShipment);
router.post('/assign-awb/:orderId', authenticate, logisticsController.assignAwb);
router.get('/label/:orderId', authenticate, logisticsController.getLabel);
router.get('/manifest/:orderId', authenticate, logisticsController.getManifest);
router.get('/track/:orderId', authenticate, logisticsController.trackAdminOrder);
router.post('/create-return-shipment/:returnId', authenticate, logisticsController.createReturnShipment);
router.get('/return-label/:returnId', authenticate, logisticsController.getReturnLabel);
router.get('/track-return/:returnId', authenticate, logisticsController.trackReturn);
router.post('/cancel', authenticate, logisticsController.cancelShipment);

module.exports = router;
