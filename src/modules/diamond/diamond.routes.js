const express = require('express');
const router = express.Router();
const diamondController = require('./diamond.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public or storefront endpoints
router.get('/attributes', diamondController.getDiamondOptions);
router.get('/lookup', diamondController.getLookup);
router.get('/sku/:sku', diamondController.getBySku);
router.get('/', diamondController.getAll);
router.get('/:id', diamondController.getOne);

// Protected Admin endpoints
router.post(
  '/bulk',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  diamondController.bulkCreate
);

router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  diamondController.create
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  diamondController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  diamondController.delete
);

module.exports = router;
