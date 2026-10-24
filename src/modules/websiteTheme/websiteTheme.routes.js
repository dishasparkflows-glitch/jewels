const express = require('express');
const router = express.Router();
const websiteThemeController = require('./websiteTheme.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

const adminOnly = [authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN)];

// ------------------------------- get public config ----------------------------
router.get('/config', websiteThemeController.getPublicConfig);

// ------------------------------- get theme publishing history ----------------------------
router.get('/themes/history', ...adminOnly, websiteThemeController.history);

// ------------------------------- get all website themes ----------------------------
router.get('/themes', ...adminOnly, websiteThemeController.list);

// ------------------------------- create website theme ----------------------------
router.post('/themes', ...adminOnly, websiteThemeController.create);

// ------------------------------- save theme media ----------------------------
router.put('/themes/:id/media', ...adminOnly, websiteThemeController.saveMedia);

// ------------------------------- preview website theme ----------------------------
router.get('/themes/:id/preview', ...adminOnly, websiteThemeController.preview);

// ------------------------------- theme media library ----------------------------
router.get('/themes/:id/media-library', ...adminOnly, websiteThemeController.getMediaLibrary);

// ------------------------------- duplicate website theme ----------------------------
router.post('/themes/:id/duplicate', ...adminOnly, websiteThemeController.duplicate);

// ------------------------------- publish website theme ----------------------------
router.post('/themes/:id/publish', ...adminOnly, websiteThemeController.publish);

// ------------------------------- rollback website theme ----------------------------
router.post('/themes/:id/rollback', ...adminOnly, websiteThemeController.rollback);

// ------------------------------- archive website theme ----------------------------
router.post('/themes/:id/archive', ...adminOnly, websiteThemeController.archive);

// ------------------------------- get one website theme ----------------------------
router.get('/themes/:id', ...adminOnly, websiteThemeController.getOne);

// ------------------------------- update website theme ----------------------------
router.put('/themes/:id', ...adminOnly, websiteThemeController.update);

router.delete('/themes/:id', ...adminOnly, websiteThemeController.remove);

module.exports = router;
