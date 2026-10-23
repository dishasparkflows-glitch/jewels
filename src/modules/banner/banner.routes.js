const express = require('express');
const router = express.Router();
router.use(require('../websiteTheme/themeMedia').storefront('banner'));
const bannerController = require('./banner.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public or storefront lookup endpoints
router.get('/category-display', bannerController.getCategoryDisplayBanner);
router.get('/display', bannerController.getCategoryDisplayBanner);
router.get('/lookup', bannerController.getLookup);
router.get('/', bannerController.getAll);
router.get('/:id', bannerController.getOne);

// Protected admin mutation endpoints
router.post(
  '/cleanup-expired-offers',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  bannerController.cleanupExpiredOffers
);

router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  bannerController.create
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  bannerController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  bannerController.delete
);

module.exports = router;
