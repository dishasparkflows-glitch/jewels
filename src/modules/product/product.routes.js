const express = require('express');
const router = express.Router();
const productController = require('./product.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public or Storefront / Lookup endpoints
router.get('/lookup', productController.getLookup);
router.get('/sku/:code', productController.getBySkuOrTag);
router.get('/', productController.getAll);
router.get('/:id', productController.getOne);

// Protected Admin endpoints
router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  productController.create
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  productController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  productController.delete
);

module.exports = router;
