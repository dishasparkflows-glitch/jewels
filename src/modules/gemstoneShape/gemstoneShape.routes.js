const express = require('express');
const router = express.Router();
const gemstoneShapeController = require('./gemstoneShape.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public or storefront lookup
router.get('/lookup', gemstoneShapeController.getLookup);
router.get('/', gemstoneShapeController.getAll);
router.get('/:id', gemstoneShapeController.getOne);

// Protected Admin endpoints
router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  gemstoneShapeController.create
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  gemstoneShapeController.update
);

router.post(
  '/bulk-delete',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  gemstoneShapeController.bulkDelete
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  gemstoneShapeController.delete
);

module.exports = router;
