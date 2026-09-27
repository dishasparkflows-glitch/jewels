const express = require('express');
const router = express.Router();
const centerDiamondPriceController = require('./centerDiamondPrice.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public / lookup endpoints
router.get('/lookup', centerDiamondPriceController.getLookup);
router.get('/', centerDiamondPriceController.getAll);
router.get('/:id', centerDiamondPriceController.getOne);

// Protected Admin endpoints
router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  centerDiamondPriceController.create
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  centerDiamondPriceController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  centerDiamondPriceController.delete
);

module.exports = router;
