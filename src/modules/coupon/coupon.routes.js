const express = require('express');
const router = express.Router();
const couponController = require('./coupon.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Protected Admin endpoints
router.post(
  '/run-cron',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  couponController.runCron
);

// Public or storefront checkout endpoints
router.get('/lookup', couponController.getLookup);
router.post('/validate', couponController.validateCoupon);
router.get('/', couponController.getAll);
router.get('/:id', couponController.getOne);

// Protected Admin CRUD endpoints
router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  couponController.create
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  couponController.update
);

router.post(
  '/bulk-delete',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  couponController.bulkDelete
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  couponController.delete
);

module.exports = router;
