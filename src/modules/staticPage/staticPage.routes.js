const express = require('express');
const router = express.Router();
const staticPageController = require('./staticPage.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public storefront endpoints
router.get('/slug/:slug', staticPageController.getBySlug);
router.get('/by-slug/:slug', staticPageController.getBySlug);
router.get('/public', staticPageController.getAll);

// Read endpoints
router.get('/', staticPageController.getAll);
router.get('/:id', staticPageController.getOne);

// Protected admin endpoints
router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  staticPageController.create
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  staticPageController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  staticPageController.delete
);

module.exports = router;
