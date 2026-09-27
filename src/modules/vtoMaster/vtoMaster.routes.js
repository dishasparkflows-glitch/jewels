const express = require('express');
const router = express.Router();
const vtoMasterController = require('./vtoMaster.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public or storefront lookup
router.get('/lookup', vtoMasterController.getLookup);
router.get('/part/:bodyPart', vtoMasterController.getByBodyPart);
router.get('/', vtoMasterController.getAll);
router.get('/:id', vtoMasterController.getOne);

// Protected Admin endpoints
router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  vtoMasterController.create
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  vtoMasterController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  vtoMasterController.delete
);

module.exports = router;
