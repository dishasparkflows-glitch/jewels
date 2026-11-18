const express = require('express');
const router = express.Router();
const gemstoneTypeController = require('./gemstoneType.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public or storefront lookup
router.get('/lookup', gemstoneTypeController.getLookup);
router.get('/', gemstoneTypeController.getAll);
router.get('/:id', gemstoneTypeController.getOne);

// Protected Admin endpoints
router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  gemstoneTypeController.create
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  gemstoneTypeController.update
);

router.post(
  '/bulk-delete',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  gemstoneTypeController.bulkDelete
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  gemstoneTypeController.delete
);

module.exports = router;
