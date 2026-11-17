const express = require('express');
const router = express.Router();
const shiprocketController = require('./shiprocket.controller');
const { authenticate, optionalAuth } = require('../../middleware/auth.middleware');

// ─── Public / Customer Tracking & Serviceability Endpoints ─────────────────

// GET /api/shiprocket/serviceability
router.get('/serviceability', shiprocketController.checkServiceability);

// GET /api/shiprocket/track/awb/:awbCode
router.get('/track/awb/:awbCode', shiprocketController.trackByAwb);

// GET /api/shiprocket/track/order/:orderId
router.get('/track/order/:orderId', optionalAuth, shiprocketController.trackByOrderId);

// POST /api/shiprocket/webhook (Carrier scan event listener)
router.post('/webhook', shiprocketController.handleWebhook);

// ─── Logistics Operations ───────────────────────────────────────────────────

router.get('/rates/:orderId', authenticate, shiprocketController.getCourierRates);
router.post('/create-shipment/:orderId', authenticate, shiprocketController.createShipment);
router.post('/assign-awb/:orderId', authenticate, shiprocketController.assignAwb);
router.get('/label/:orderId', authenticate, shiprocketController.getLabel);
router.get('/manifest/:orderId', authenticate, shiprocketController.getManifest);
router.get('/track/:orderId', authenticate, shiprocketController.trackAdminOrder);
router.post('/create-return-shipment/:returnId', authenticate, shiprocketController.createReturnShipment);
router.get('/return-label/:returnId', authenticate, shiprocketController.getReturnLabel);
router.get('/track-return/:returnId', authenticate, shiprocketController.trackReturn);
router.post('/cancel', authenticate, shiprocketController.cancelShipment);

module.exports = router;
