const express = require('express');
const router = express.Router();
const featuredController = require('./featured.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public or storefront lookup
router.get('/lookup', featuredController.getLookup);
router.get('/', featuredController.getAll);
router.get('/:id', featuredController.getOne);

// Protected Admin endpoints
router.put(
  '/reorder',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  featuredController.reorder
);

router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  featuredController.create
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  featuredController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  featuredController.delete
);

module.exports = router;
