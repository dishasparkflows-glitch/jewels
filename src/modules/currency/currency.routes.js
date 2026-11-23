const express = require('express');
const router = express.Router();
const currencyController = require('./currency.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public & Storefront endpoints
router.get('/', currencyController.getAll);
router.get('/code/:code', currencyController.getByCode);
router.get('/:id', currencyController.getOne);

// Sync exchange rates (Admin only)
router.post('/sync-rates', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), currencyController.syncLiveRates);
router.post('/:id/sync', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), currencyController.syncOneRate);

// Management endpoints (Admin only)
router.post('/', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), currencyController.create);
router.post('/bulk-delete', authenticate, authorize(ROLES.SUPER_ADMIN), currencyController.bulkDelete);
router.put('/:id', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), currencyController.update);
router.delete('/:id', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), currencyController.delete);

module.exports = router;
