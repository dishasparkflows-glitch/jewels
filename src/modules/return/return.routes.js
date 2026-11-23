const express = require('express');
const router = express.Router();
const returnController = require('./return.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

router.use(authenticate);

router.post('/', returnController.createReturn);
router.get('/my', returnController.getMyReturns);
router.get('/:id', returnController.getReturnById);

// Admin-only return management
router.get('/', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), returnController.getAllReturns);
router.patch('/:id/status', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), returnController.updateReturnStatus);

module.exports = router;
