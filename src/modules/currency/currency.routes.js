const express = require('express');
const router = express.Router();
const currencyController = require('./currency.controller');

// Public & Storefront endpoints
router.get('/', currencyController.getAll);
router.get('/code/:code', currencyController.getByCode);
router.get('/:id', currencyController.getOne);

// Sync exchange rates
router.post('/sync-rates', currencyController.syncLiveRates);
router.post('/:id/sync', currencyController.syncOneRate);

// Management endpoints
router.post('/', currencyController.create);
router.put('/:id', currencyController.update);
router.delete('/:id', currencyController.delete);

module.exports = router;
