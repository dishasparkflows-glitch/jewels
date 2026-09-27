const express = require('express');
const router = express.Router();
const birthstoneController = require('./birthstone.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public endpoints
router.get('/lookup', birthstoneController.getLookup);
router.get('/month/:month', birthstoneController.getByMonth);
router.get('/', birthstoneController.getAll);
router.get('/:id', birthstoneController.getOne);

// Protected admin endpoints
router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  birthstoneController.create
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  birthstoneController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  birthstoneController.delete
);

module.exports = router;
