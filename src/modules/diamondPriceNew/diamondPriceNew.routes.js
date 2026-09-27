const express = require('express');
const router = express.Router();
const diamondPriceNewController = require('./diamondPriceNew.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public or lookup
router.get('/lookup', diamondPriceNewController.getLookup);
router.get('/', diamondPriceNewController.getAll);
router.get('/:id', diamondPriceNewController.getOne);

// Protected Admin endpoints
router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  diamondPriceNewController.create
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  diamondPriceNewController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  diamondPriceNewController.delete
);

module.exports = router;
