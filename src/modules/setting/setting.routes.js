const express = require('express');
const router = express.Router();
const settingController = require('./setting.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public or storefront config getter
router.get('/', settingController.getSettings);
router.get('/common', settingController.getCommonSettings);
router.get('/lookup', settingController.getLookup);

// Protected admin settings
router.use(authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router.put('/', settingController.updateSettings);
router.post('/', settingController.create);
router.get('/:id', settingController.getOne);
router.put('/:id', settingController.update);
router.delete('/:id', settingController.delete);

module.exports = router;
