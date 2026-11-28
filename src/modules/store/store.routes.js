const express = require('express');
const router = express.Router();
const storeController = require('./store.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public endpoints
router.get('/lookup', storeController.getLookup);
router.get('/states', storeController.getStatesSummary);
router.get('/slug/:slug', storeController.getBySlug);
router.get('/', storeController.getAll);
router.get('/:id', storeController.getOne);

// Protected admin endpoints
router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  storeController.create
);

router.post(
  '/bulk-delete',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  storeController.bulkDelete
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  storeController.update
);

router.patch(
  '/:id/status',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  storeController.toggleStatus
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  storeController.delete
);

module.exports = router;
