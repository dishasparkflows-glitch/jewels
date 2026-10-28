const express = require('express');
const router = express.Router();
const galleryController = require('./gallery.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

const adminOnly = [authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN)];

// ------------------------------- gallery routes ----------------------------
router.get('/themes', ...adminOnly, galleryController.getThemesLookup);
router.get('/banners', ...adminOnly, galleryController.getBannersLookup);
router.get('/', ...adminOnly, galleryController.list);
router.get('/:id', ...adminOnly, galleryController.getOne);
router.post('/', ...adminOnly, galleryController.create);
router.post('/upload-assign', ...adminOnly, galleryController.uploadAndAssign);
router.put('/:id', ...adminOnly, galleryController.update);
router.patch('/:id/status', ...adminOnly, galleryController.toggleStatus);
router.delete('/:id', ...adminOnly, galleryController.deleteItem);

module.exports = router;

