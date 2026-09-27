const express = require('express');
const router = express.Router();
const sieveSizeController = require('./sieveSize.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public or storefront lookup
router.get('/lookup', sieveSizeController.getLookup);
router.get('/', sieveSizeController.getAll);
router.get('/:id', sieveSizeController.getOne);

// Protected Admin endpoints
router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  sieveSizeController.create
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  sieveSizeController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  sieveSizeController.delete
);

module.exports = router;
