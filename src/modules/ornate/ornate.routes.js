const express = require('express');
const router = express.Router();
const ornateController = require('./ornate.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// All Ornate ERP endpoints require Admin or Super Admin authentication
router.use(authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

// Diagnostic & Status
router.get('/test-connection', ornateController.testConnection);
router.get('/status', ornateController.getStatus);

// Admin-protected ERP Sync operations
router.post('/sync', ornateController.triggerFullSync);
router.post('/sync-labels', ornateController.syncLabels);
router.post('/sync-sold', ornateController.syncSold);
router.post('/sync-selected-sold', ornateController.syncSelectedSold);
router.post('/sync-metal-rates', ornateController.syncMetalRates);
router.get('/categories', ornateController.getCategories);
router.get('/sold-labels', ornateController.getSoldLabels);

module.exports = router;
