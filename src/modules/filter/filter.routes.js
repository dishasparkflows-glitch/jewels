const express = require('express');
const router = express.Router();
const filterController = require('./filter.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public storefront filters endpoint
router.get('/', filterController.getFilters);
router.get('/category/:categoryId', filterController.getFilters);
router.get('/admin/all', filterController.getAllWithCategories);

// Protected admin endpoints to manage filters and category-wise configurations
router.put(
  '/category/:categoryId',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  filterController.updateCategoryFilters
);

router.put(
  '/:filterId/categories',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  filterController.updateFilterCategories
);

router.put(
  '/admin/reorder',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  filterController.reorderFilters
);

router.put(
  '/:filterId',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  filterController.updateFilter
);

module.exports = router;

