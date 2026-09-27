const express = require('express');
const router = express.Router();
const custJewelleryBeforeAfterController = require('./custJewelleryBeforeAfter.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public endpoints
router.get('/lookup', custJewelleryBeforeAfterController.getLookup);
router.get('/', custJewelleryBeforeAfterController.getAll);
router.get('/:id', custJewelleryBeforeAfterController.getOne);

// Protected Admin endpoints
router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  custJewelleryBeforeAfterController.create
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  custJewelleryBeforeAfterController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  custJewelleryBeforeAfterController.delete
);

module.exports = router;
