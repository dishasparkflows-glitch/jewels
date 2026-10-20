const express = require('express');
const router = express.Router();
const blogCategoryController = require('./blogCategory.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public lookup & reading
router.get('/lookup', blogCategoryController.getLookup);
router.get('/slug/:slug', blogCategoryController.getBySlug);
router.get('/', blogCategoryController.getAll);
router.get('/:id', blogCategoryController.getOne);

// Protected admin operations
router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  blogCategoryController.create
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  blogCategoryController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  blogCategoryController.delete
);

module.exports = router;
