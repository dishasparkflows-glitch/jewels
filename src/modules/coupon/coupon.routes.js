const express = require('express');
const router = express.Router();
const couponController = require('./coupon.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public or storefront checkout endpoints
router.get('/lookup', couponController.getLookup);
router.post('/validate', couponController.validateCoupon);
router.get('/code/:code', couponController.getByCode);
router.get('/', couponController.getAll);
router.get('/:id', couponController.getOne);

// Protected Admin endpoints
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

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  couponController.delete
);

module.exports = router;
