const express = require('express');
const router = express.Router();
router.use(require('../websiteTheme/themeMedia').storefront('category'));
const categoryController = require('./category.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public or storefront lookup endpoints
router.get('/navigation', categoryController.getNavigation);
router.get('/lookup', categoryController.getLookup);
router.get('/', categoryController.getAll);
router.get('/:id', categoryController.getOne);

// Protected Admin endpoints
router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  categoryController.create
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  categoryController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  categoryController.delete
);

module.exports = router;
