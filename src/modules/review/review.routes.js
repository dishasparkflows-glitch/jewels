const express = require('express');
const router = express.Router();
const reviewController = require('./review.controller');
const { authenticate, authorize, optionalAuth } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

router.get('/lookup', reviewController.getLookup);
router.get('/', reviewController.getAll);
router.get('/:id', reviewController.getOne);

// Allow customers / users / admin to submit a review
router.post('/', optionalAuth, reviewController.create);

// Admin-only moderation & deletion
router.put('/:id', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), reviewController.update);
router.post('/bulk-delete', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), reviewController.bulkDelete);
router.delete('/:id', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), reviewController.delete);

module.exports = router;
