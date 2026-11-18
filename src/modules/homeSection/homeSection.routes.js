const express = require('express');
const router = express.Router();
const homeSectionController = require('./homeSection.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// ─── Admin Endpoints ────────────────────────────────────
router.get('/', homeSectionController.getAll);
router.get('/:id', homeSectionController.getOne);

router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  homeSectionController.create
);

router.put(
  '/reorder',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  homeSectionController.reorder
);

router.post(
  '/bulk-delete',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  homeSectionController.bulkDelete
);

router.patch(
  '/:id/toggle-status',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  homeSectionController.toggleStatus
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  homeSectionController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  homeSectionController.delete
);

module.exports = router;
