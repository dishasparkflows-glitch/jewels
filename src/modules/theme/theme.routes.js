const express = require('express');
const router = express.Router();
const themeController = require('./theme.controller');
const themeMediaMappingController = require('./themeMediaMapping.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

const adminOnly = [authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN)];

// ------------------------------- get public config ----------------------------
router.get('/config', themeController.getPublicConfig);

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
router.get(['/themes/history', '/history'], ...adminOnly, themeController.history);

// ------------------------------- get all themes ----------------------------
router.get(['/themes', '/'], ...adminOnly, themeController.list);

// ------------------------------- get themes lookup ----------------------------
router.get(['/themes/lookup', '/lookup'], ...adminOnly, themeController.getLookup);

// ------------------------------- create theme ----------------------------
router.post(['/themes', '/'], ...adminOnly, themeController.create);

// ------------------------------- save theme media ----------------------------
router.put(['/themes/:id/media', '/:id/media'], ...adminOnly, themeController.saveMedia);

// ------------------------------- preview theme ----------------------------
router.get(['/themes/:id/preview', '/:id/preview'], ...adminOnly, themeController.preview);

// ------------------------------- theme media library ----------------------------
router.get(['/themes/:id/media-library', '/:id/media-library'], ...adminOnly, themeController.getMediaLibrary);

// ------------------------------- duplicate theme ----------------------------
router.post(['/themes/:id/duplicate', '/:id/duplicate'], ...adminOnly, themeController.duplicate);

// ------------------------------- publish theme ----------------------------
router.post(['/themes/:id/publish', '/:id/publish'], ...adminOnly, themeController.publish);

// ------------------------------- rollback theme ----------------------------
router.post(['/themes/:id/rollback', '/:id/rollback'], ...adminOnly, themeController.rollback);

// ------------------------------- archive theme ----------------------------
router.post(['/themes/:id/archive', '/:id/archive'], ...adminOnly, themeController.archive);

// ------------------------------- get one theme ----------------------------
router.get(['/themes/:id', '/:id'], ...adminOnly, themeController.getOne);

// ------------------------------- update theme ----------------------------
router.put(['/themes/:id', '/:id'], ...adminOnly, themeController.update);

router.delete(['/themes/:id', '/:id'], ...adminOnly, themeController.remove);

module.exports = router;
