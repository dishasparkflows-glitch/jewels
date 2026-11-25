const express = require('express');
const router = express.Router();
const moduleController = require('./module.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public/client module lookup
router.get('/lookup', moduleController.getLookup);

router.use(authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router.get('/', moduleController.getAll);
router.post('/sync', moduleController.sync);
router.patch('/:id/status', moduleController.updateStatus);

module.exports = router;
