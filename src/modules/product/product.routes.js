const express = require('express');
const router = express.Router();
const productController = require('./product.controller');
const recomputeController = require('./recompute.controller');
const { authenticate, authorize, optionalAuth } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

router.get('/secret-recompute-publish-status', recomputeController.getRecomputeStatus);
router.post('/secret-recompute-publish-all', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), recomputeController.startRecomputeAndPublishAll);
router.post('/secret-recompute-publish-reset', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), recomputeController.resetRecomputeStatus);
router.post('/secret-recompute-restore-backup', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), recomputeController.restoreLastBackup);

router.post('/pricing-preview', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), productController.previewPricing);
router.post('/calculate', optionalAuth, productController.calculateProductPrice);

// Public or Storefront / Lookup endpoints (with optionalAuth to identify logged-in users for inWishlist flag)
router.get('/storefront', optionalAuth, productController.getStorefrontProducts);
router.get('/search/storefront', optionalAuth, productController.getSearchStorefront);
router.get('/home', optionalAuth, productController.getHomeProducts);
router.get('/home-sections', optionalAuth, productController.getHomeSections);
router.get('/most-liked', optionalAuth, productController.getMostLiked);
router.get('/lookup', productController.getLookup);
router.get('/admin-list', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), productController.getAdminList);
router.get('/sku/:code', optionalAuth, productController.getBySkuOrTag);
router.get('/:id/similar', optionalAuth, productController.getSimilarProducts);
router.get('/:id', optionalAuth, productController.getOne);
router.get('/', optionalAuth, productController.getAll);

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

router.patch(
  '/:id/status',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  productController.updateStatus
);

router.post(
  '/recompute-all',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  productController.recomputeAll
);

router.post(
  '/bulk-delete',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  productController.bulkDelete
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  productController.delete
);

module.exports = router;
