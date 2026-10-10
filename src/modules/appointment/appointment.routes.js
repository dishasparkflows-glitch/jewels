const express = require('express');
const router = express.Router();
const appointmentController = require('./appointment.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public can book appointment
router.post('/', appointmentController.create);

// Protected Admin endpoints
router.get(
  '/lookup',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  appointmentController.getLookup
);

router.get(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  appointmentController.getAll
);

router.get(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  appointmentController.getOne
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  appointmentController.update
);

router.post(
  '/bulk-delete',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  appointmentController.bulkDelete
);

router.delete(
  '/bulk-delete',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  appointmentController.bulkDelete
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  appointmentController.delete
);

module.exports = router;
