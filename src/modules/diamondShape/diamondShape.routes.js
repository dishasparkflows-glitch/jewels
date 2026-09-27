const express = require('express');
const router = express.Router();
const diamondShapeController = require('./diamondShape.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public or storefront lookup
router.get('/lookup', diamondShapeController.getLookup);
router.get('/', diamondShapeController.getAll);
router.get('/:id', diamondShapeController.getOne);

// Protected Admin endpoints
router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  diamondShapeController.create
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  diamondShapeController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  diamondShapeController.delete
);

module.exports = router;
