const express = require('express');
const router = express.Router();
const productController = require('./product.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

router.post('/pricing-preview', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), productController.previewPricing);

// Public or Storefront / Lookup endpoints
router.get('/storefront', productController.getStorefrontProducts);
router.get('/home', productController.getHomeProducts);
router.get('/home/storefront', productController.getHomeProducts);
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
