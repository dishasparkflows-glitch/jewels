const express = require('express');
const router = express.Router();
const addressController = require('./address.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// All address routes require authentication
router.use(authenticate);

// Current user addresses
router.get('/', addressController.getMyAddresses);
router.post('/', addressController.createAddress);

// Default address update
router.patch('/:id/default', addressController.setDefaultAddress);

// Specific address operations
router.get('/:id', addressController.getAddressById);
router.put('/:id', addressController.updateAddress);
router.delete('/:id', addressController.deleteAddress);

// Admin-only route to inspect specific user addresses
router.get(
  '/user/:userId',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  addressController.getUserAddressesAdmin
);

module.exports = router;
