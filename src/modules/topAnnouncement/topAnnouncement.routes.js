const express = require('express');
const router = express.Router();
const topAnnouncementController = require('./topAnnouncement.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// ─── Public Storefront Endpoints ────────────────────────
router.get('/public', topAnnouncementController.getPublic);
router.get('/settings', topAnnouncementController.getSettings);
router.get('/active', topAnnouncementController.getPublic);

// ─── Admin Endpoints ────────────────────────────────────
router.get('/', topAnnouncementController.getAll);
router.get('/:id', topAnnouncementController.getOne);

router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  topAnnouncementController.create
);

router.put(
  '/settings',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  topAnnouncementController.updateSettings
);

router.put(
  '/reorder',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  topAnnouncementController.reorder
);


router.post(
  '/:id/duplicate',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  topAnnouncementController.duplicate
);

router.patch(
  '/:id/toggle-status',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  topAnnouncementController.toggleStatus
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  topAnnouncementController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  topAnnouncementController.delete
);

module.exports = router;
