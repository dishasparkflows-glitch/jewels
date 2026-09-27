const express = require('express');
const router = express.Router();
const userController = require('./user.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// All user routes require authentication
router.use(authenticate);

// Current user profile
router.get('/me', userController.getMe);
router.put('/me', userController.updateMe);

// Admin-only routes
router.get('/', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), userController.getAll);
router.get('/:id', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), userController.getById);
router.post('/', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), userController.create);
router.put('/:id', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), userController.update);
router.delete('/:id', authorize(ROLES.SUPER_ADMIN), userController.remove);
router.patch('/:id/toggle-status', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), userController.toggleStatus);

module.exports = router;
