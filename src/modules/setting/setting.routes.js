const express = require('express');
const router = express.Router();
const settingController = require('./setting.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// Public or storefront config getter
router.get('/', settingController.getSettings);
router.get('/lookup', settingController.getLookup);

// Protected admin settings
router.put('/', authenticate, settingController.updateSettings);
router.post('/', authenticate, settingController.create);
router.get('/all', authenticate, settingController.getAll);
router.get('/:id', settingController.getOne);
router.put('/:id', authenticate, settingController.update);
router.delete('/:id', authenticate, settingController.delete);

module.exports = router;
