const express = require('express');
const router = express.Router();
const goldPriceController = require('./goldPrice.controller');
const { optionalAuth, authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public lookup for storefront & calculators
router.get('/', optionalAuth, goldPriceController.getLatest);

// Admin update & sync
router.put('/', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), goldPriceController.updateRates);
router.post('/', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), goldPriceController.updateRates);

module.exports = router;
