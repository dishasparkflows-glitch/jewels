const express = require('express');
const router = express.Router();
const ornateController = require('./ornate.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Diagnostic & Status
router.get('/test-connection', ornateController.testConnection);
router.get('/status', ornateController.getStatus);

// Admin-protected ERP Sync operations
router.post(
  '/sync',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  ornateController.triggerFullSync
);

router.post(
  '/sync-labels',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  ornateController.syncLabels
);

router.post(
  '/sync-sold',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  ornateController.syncSold
);

router.post(
  '/sync-selected-sold',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  ornateController.syncSelectedSold
);

router.post(
  '/sync-metal-rates',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  ornateController.syncMetalRates
);

router.get(
  '/categories',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  ornateController.getCategories
);

router.get(
  '/sold-labels',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  ornateController.getSoldLabels
);

module.exports = router;
