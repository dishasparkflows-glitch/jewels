const express = require('express');
const router = express.Router();
const sideDiamondPriceController = require('./sideDiamondPrice.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public or lookup
router.get('/lookup', sideDiamondPriceController.getLookup);
router.get('/', sideDiamondPriceController.getAll);
router.get('/:id', sideDiamondPriceController.getOne);

// Protected Admin endpoints
router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  sideDiamondPriceController.create
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  sideDiamondPriceController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  sideDiamondPriceController.delete
);

module.exports = router;
