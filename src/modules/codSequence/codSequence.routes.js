const express = require('express');
const router = express.Router();
const codSequenceController = require('./codSequence.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public endpoints
router.get('/lookup', codSequenceController.getLookup);
router.get('/calculate', codSequenceController.calculateFee);
router.get('/', codSequenceController.getAll);
router.get('/:id', codSequenceController.getOne);

// Protected Admin endpoints
router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  codSequenceController.create
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  codSequenceController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  codSequenceController.delete
);

module.exports = router;
