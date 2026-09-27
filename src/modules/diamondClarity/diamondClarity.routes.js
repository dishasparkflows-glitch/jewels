const express = require('express');
const router = express.Router();
const diamondClarityController = require('./diamondClarity.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public or storefront lookup endpoints
router.get('/lookup', diamondClarityController.getLookup);
router.get('/', diamondClarityController.getAll);
router.get('/:id', diamondClarityController.getOne);

// Protected Admin endpoints
router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  diamondClarityController.create
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  diamondClarityController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  diamondClarityController.delete
);

module.exports = router;
