const express = require('express');
const router = express.Router();
const menuItemController = require('./menuItem.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public or storefront lookup
router.get('/lookup', menuItemController.getLookup);
router.get('/', menuItemController.getAll);
router.get('/:id', menuItemController.getOne);

// Protected Admin endpoints
router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  menuItemController.create
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  menuItemController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  menuItemController.delete
);

module.exports = router;
