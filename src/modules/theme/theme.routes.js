const express = require('express');
const router = express.Router();
const themeController = require('./theme.controller');
const themeMediaMappingController = require('./themeMediaMapping.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

const adminOnly = [authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN)];

// ------------------------------- public config ----------------------------
router.get('/config', themeController.getPublicConfig);

// ------------------------------- theme media mapping endpoints ----------------------------
router.get('/modules', ...adminOnly, themeMediaMappingController.getSupportedModules);
router.get('/:themeId/media-mapping/records', ...adminOnly, themeMediaMappingController.getModuleRecords);
router.get('/:themeId/media-mapping/summary', ...adminOnly, themeMediaMappingController.getSummary);
router.get('/:themeId/media-mappings', ...adminOnly, themeMediaMappingController.getThemeMappings);
router.put('/:themeId/media-mappings/bulk', ...adminOnly, themeMediaMappingController.bulkSave);
router.put('/:themeId/media-mappings', ...adminOnly, themeMediaMappingController.upsert);
router.delete('/:themeId/media-mappings/:mappingId', ...adminOnly, themeMediaMappingController.deleteMapping);
router.delete('/:themeId/media-mappings', ...adminOnly, themeMediaMappingController.deleteMappingByTarget);
router.post('/:themeId/activate', ...adminOnly, themeMediaMappingController.activateTheme);

// ------------------------------- theme management endpoints ----------------------------
router.get('/history', ...adminOnly, themeController.history);
router.get('/lookup', ...adminOnly, themeController.getLookup);
router.get('/', ...adminOnly, themeController.list);
router.post('/', ...adminOnly, themeController.create);

router.put('/:id/media', ...adminOnly, themeController.saveMedia);
router.get('/:id/preview', ...adminOnly, themeController.preview);
router.get('/:id/media-library', ...adminOnly, themeController.getMediaLibrary);
router.post('/:id/duplicate', ...adminOnly, themeController.duplicate);
router.post('/:id/publish', ...adminOnly, themeController.publish);
router.post('/:id/rollback', ...adminOnly, themeController.rollback);
router.post('/:id/archive', ...adminOnly, themeController.archive);
router.get('/:id', ...adminOnly, themeController.getOne);
router.put('/:id', ...adminOnly, themeController.update);
router.delete('/:id', ...adminOnly, themeController.remove);

module.exports = router;
