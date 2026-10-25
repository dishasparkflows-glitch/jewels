const express = require('express');
const router = express.Router();
const productGroupController = require('./productGroup.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Admin-only middleware shorthand
const adminAuth = [authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN)];

// 1. Tab Counts & Ungrouped Products (must precede parameterized /:id)
router.get('/tab-counts', adminAuth, productGroupController.getTabCounts);
router.get('/ungrouped-products', adminAuth, productGroupController.getUngrouped);
router.get('/summary', adminAuth, productGroupController.getSummary);

// 2. Sync Operations
router.post('/:id/sync/preview', adminAuth, productGroupController.previewSync);
router.post('/:id/sync', adminAuth, productGroupController.executeSync);

// 3. Membership Operations
router.post('/:id/products', adminAuth, productGroupController.addProducts);
router.delete('/:id/products/:productId', adminAuth, productGroupController.removeProduct);
router.post('/:id/move-products', adminAuth, productGroupController.moveProducts);
router.post('/:id/approve', adminAuth, productGroupController.approveGroup);

// 4. Group Details & CRUD
router.get('/:id', productGroupController.getOne);
router.patch('/:id', adminAuth, productGroupController.update);
router.delete('/:id', adminAuth, productGroupController.delete);
router.get('/', productGroupController.getAll);
router.post('/', adminAuth, productGroupController.create);

module.exports = router;
