const express = require('express');
const router = express.Router();
const footerSettingsController = require('./footerSettings.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// Public or Admin footer settings getter
router.get('/settings', footerSettingsController.getSettings);
router.get('/lookup', footerSettingsController.getLookup);
router.get('/', footerSettingsController.getSettings);
router.get('/:id', footerSettingsController.getOne);

// Protected Admin endpoints
router.put('/settings', authenticate, footerSettingsController.updateSettings);
router.put('/', authenticate, footerSettingsController.updateSettings);
router.post('/', authenticate, footerSettingsController.create);
router.put('/:id', authenticate, footerSettingsController.update);
router.delete('/:id', authenticate, footerSettingsController.delete);

module.exports = router;
