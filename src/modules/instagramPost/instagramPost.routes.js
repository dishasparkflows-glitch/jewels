const express = require('express');
const router = express.Router();
const instagramPostController = require('./instagramPost.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public or storefront lookup
router.get('/lookup', instagramPostController.getLookup);
router.get('/', instagramPostController.getAll);
router.get('/:id', instagramPostController.getOne);

// Protected Admin endpoints
router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  instagramPostController.create
);

router.put(
  '/reorder',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  instagramPostController.reorder
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  instagramPostController.update
);

router.post(
  '/bulk-delete',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  instagramPostController.bulkDelete
);

router.delete(
  '/bulk-delete',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  instagramPostController.bulkDelete
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  instagramPostController.delete
);

module.exports = router;
