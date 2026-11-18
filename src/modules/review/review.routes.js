const express = require('express');
const router = express.Router();
const reviewController = require('./review.controller');
const { authenticate, optionalAuth } = require('../../middleware/auth.middleware');

router.get('/lookup', reviewController.getLookup);
router.get('/', reviewController.getAll);
router.get('/:id', reviewController.getOne);

// Allow customers / users / admin to submit a review
router.post('/', optionalAuth, reviewController.create);
router.put('/:id', authenticate, reviewController.update);
router.post('/bulk-delete', authenticate, reviewController.bulkDelete);
router.delete('/:id', authenticate, reviewController.delete);

module.exports = router;
