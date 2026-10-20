const express = require('express');
const router = express.Router();
const blogController = require('./blog.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public endpoints
router.get('/recent', blogController.getRecent);
router.get('/slug/:slug', blogController.getBySlug);
router.get('/', blogController.getAll);
router.get('/:id', blogController.getOne);

// Protected admin endpoints
router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  blogController.create
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  blogController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  blogController.delete
);

module.exports = router;
