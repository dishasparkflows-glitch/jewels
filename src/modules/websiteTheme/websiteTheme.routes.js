const express = require('express');
const router = express.Router();
const websiteThemeController = require('./websiteTheme.controller');
const themeMediaMappingController = require('./themeMediaMapping.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

const adminOnly = [authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN)];

// ------------------------------- get public config ----------------------------
router.get('/config', websiteThemeController.getPublicConfig);

// ------------------------------- theme media mapping endpoints ----------------------------
router.get('/themes/modules', ...adminOnly, themeMediaMappingController.getSupportedModules);
router.get('/modules', ...adminOnly, themeMediaMappingController.getSupportedModules);

router.get('/themes/:themeId/media-mapping/records', ...adminOnly, themeMediaMappingController.getModuleRecords);
router.get('/:themeId/media-mapping/records', ...adminOnly, themeMediaMappingController.getModuleRecords);

router.get('/themes/:themeId/media-mapping/summary', ...adminOnly, themeMediaMappingController.getSummary);
router.get('/:themeId/media-mapping/summary', ...adminOnly, themeMediaMappingController.getSummary);

router.get('/themes/:themeId/media-mappings', ...adminOnly, themeMediaMappingController.getThemeMappings);
router.get('/:themeId/media-mappings', ...adminOnly, themeMediaMappingController.getThemeMappings);

router.put('/themes/:themeId/media-mappings/bulk', ...adminOnly, themeMediaMappingController.bulkSave);
router.put('/:themeId/media-mappings/bulk', ...adminOnly, themeMediaMappingController.bulkSave);

router.put('/themes/:themeId/media-mappings', ...adminOnly, themeMediaMappingController.upsert);
router.put('/:themeId/media-mappings', ...adminOnly, themeMediaMappingController.upsert);

router.delete('/themes/:themeId/media-mappings/:mappingId', ...adminOnly, themeMediaMappingController.deleteMapping);
router.delete('/:themeId/media-mappings/:mappingId', ...adminOnly, themeMediaMappingController.deleteMapping);

router.delete('/themes/:themeId/media-mappings', ...adminOnly, themeMediaMappingController.deleteMappingByTarget);
router.delete('/:themeId/media-mappings', ...adminOnly, themeMediaMappingController.deleteMappingByTarget);

// One-click Theme Activation
router.post('/themes/:themeId/activate', ...adminOnly, themeMediaMappingController.activateTheme);
router.post('/:themeId/activate', ...adminOnly, themeMediaMappingController.activateTheme);

// ------------------------------- get theme publishing history ----------------------------
router.get('/themes/history', ...adminOnly, websiteThemeController.history);

// ------------------------------- get all website themes ----------------------------
router.get('/themes', ...adminOnly, websiteThemeController.list);

// ------------------------------- get themes lookup ----------------------------
router.get('/themes/lookup', ...adminOnly, websiteThemeController.getLookup);

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
