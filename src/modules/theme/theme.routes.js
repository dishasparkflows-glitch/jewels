const express = require('express');
const router = express.Router();
const themeController = require('./theme.controller');
const themeMediaMappingController = require('./themeMediaMapping.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

const adminOnly = [authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN)];

// ------------------------------- theme media mapping endpoints ----------------------------
router.get('/:themeId/media-mapping/records', ...adminOnly, themeMediaMappingController.getModuleRecords);
router.get('/:themeId/media-mapping/summary', ...adminOnly, themeMediaMappingController.getSummary);
router.put('/:themeId/media-mappings', ...adminOnly, themeMediaMappingController.upsert);
router.post('/:themeId/activate', ...adminOnly, themeMediaMappingController.activateTheme);

// ------------------------------- theme management endpoints ----------------------------
router.get('/lookup', ...adminOnly, themeController.getLookup);
router.get('/', ...adminOnly, themeController.list);
router.post('/', ...adminOnly, themeController.create);

router.put('/:id/media', ...adminOnly, themeController.saveMedia);
router.post('/:id/publish', ...adminOnly, themeController.publish);
router.get('/:id', ...adminOnly, themeController.getOne);
router.put('/:id', ...adminOnly, themeController.update);
router.delete('/:id', ...adminOnly, themeController.remove);

module.exports = router;
