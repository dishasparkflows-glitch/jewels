const express = require('express');
const router = express.Router();
const shiprocketController = require('./shiprocket.controller');
const { authenticate, optionalAuth } = require('../../middleware/auth.middleware');

// ─── Public / Customer Tracking & Serviceability Endpoints ─────────────────

// GET /api/shiprocket/serviceability
router.get('/serviceability', shiprocketController.checkServiceability);

// GET /api/shiprocket/track/awb or GET /api/shiprocket/track/awb/:awbCode
router.get('/track/awb', shiprocketController.trackByAwb);
router.get('/track/awb/:awbCode', shiprocketController.trackByAwb);

// GET /api/shiprocket/track/order/:orderId
router.get('/track/order/:orderId', optionalAuth, shiprocketController.trackByOrderId);

// POST /api/shiprocket/webhook (Carrier scan event listener)
router.post('/webhook', shiprocketController.handleWebhook);

// ─── Admin Logistics Operations (Sub-routes under /api/shiprocket/admin) ───
const adminRouter = express.Router();
adminRouter.use(authenticate);

adminRouter.get('/rates/:orderId', shiprocketController.getCourierRates);
adminRouter.post('/create-shipment/:orderId', shiprocketController.createShipment);
adminRouter.post('/assign-awb/:orderId', shiprocketController.assignAwb);
adminRouter.get('/label/:orderId', shiprocketController.getLabel);
adminRouter.get('/manifest/:orderId', shiprocketController.getManifest);
adminRouter.get('/track/:orderId', shiprocketController.trackAdminOrder);
adminRouter.post('/create-return-shipment/:returnId', shiprocketController.createReturnShipment);
adminRouter.get('/return-label/:returnId', shiprocketController.getReturnLabel);
adminRouter.get('/track-return/:returnId', shiprocketController.trackReturn);
adminRouter.post('/cancel', shiprocketController.cancelShipment);

// Mount adminRouter on both /admin and export it for direct /api/admin/logistics mount
router.use('/admin', adminRouter);

module.exports = {
  shiprocketRouter: router,
  adminLogisticsRouter: adminRouter,
};
