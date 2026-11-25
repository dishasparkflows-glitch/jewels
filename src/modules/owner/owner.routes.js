const express = require('express');
const router = express.Router();
const ownerController = require('./owner.controller');
const { authenticate, authorize, optionalAuth } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public/Client module discovery & access lookup
router.get('/modules', ownerController.getModules);
router.get('/access', optionalAuth, ownerController.getAccess);

// Admin-protected endpoints
router.use(authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router.get('/lookup', ownerController.getLookup);
router.get('/', ownerController.getAll);
router.get('/:id', ownerController.getOne);
router.post('/', ownerController.create);
router.put('/:id', ownerController.update);
router.post('/bulk-delete', ownerController.bulkDelete);
router.delete('/:id', ownerController.delete);

module.exports = router;
