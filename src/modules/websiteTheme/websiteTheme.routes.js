const express = require('express');
const router = express.Router();
const controller = require('./websiteTheme.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

const adminOnly = [authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN)];

router.get('/config', controller.getPublicConfig);
router.get('/themes/history', ...adminOnly, controller.history);
router.get('/themes', ...adminOnly, controller.list);
router.post('/themes', ...adminOnly, controller.create);
router.get('/themes/:id/preview', ...adminOnly, controller.preview);
router.post('/themes/:id/duplicate', ...adminOnly, controller.duplicate);
router.post('/themes/:id/publish', ...adminOnly, controller.publish);
router.post('/themes/:id/rollback', ...adminOnly, controller.rollback);
router.post('/themes/:id/archive', ...adminOnly, controller.archive);
router.get('/themes/:id', ...adminOnly, controller.getOne);
router.put('/themes/:id', ...adminOnly, controller.update);

module.exports = router;
