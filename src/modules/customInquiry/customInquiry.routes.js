const express = require('express');
const router = express.Router();
const customInquiryController = require('./customInquiry.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Public inquiry submission from website
router.post('/', customInquiryController.create);

// Protected Admin endpoints
router.get(
  '/lookup',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  customInquiryController.getLookup
);

router.get(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  customInquiryController.getAll
);

router.get(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  customInquiryController.getOne
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  customInquiryController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  customInquiryController.delete
);

module.exports = router;
