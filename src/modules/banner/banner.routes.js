const express = require('express');
const router = express.Router();
const bannerController = require('./banner.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public or storefront lookup endpoints
router.get('/lookup', bannerController.getLookup);
router.get('/', bannerController.getAll);
router.get('/:id', bannerController.getOne);

// Protected admin mutation endpoints
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
