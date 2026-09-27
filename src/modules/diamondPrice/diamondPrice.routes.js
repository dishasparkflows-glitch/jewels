const express = require('express');
const router = express.Router();
const diamondPriceController = require('./diamondPrice.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public or lookup
router.get('/lookup', diamondPriceController.getLookup);
router.get('/', diamondPriceController.getAll);
router.get('/:id', diamondPriceController.getOne);

// Protected Admin endpoints
router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  diamondPriceController.create
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  diamondPriceController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  diamondPriceController.delete
);

module.exports = router;
