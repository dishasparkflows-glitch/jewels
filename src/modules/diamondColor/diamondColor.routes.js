const express = require('express');
const router = express.Router();
const diamondColorController = require('./diamondColor.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public or storefront lookup
router.get('/lookup', diamondColorController.getLookup);
router.get('/', diamondColorController.getAll);
router.get('/:id', diamondColorController.getOne);

// Protected Admin endpoints
router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  diamondColorController.create
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  diamondColorController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  diamondColorController.delete
);

module.exports = router;
