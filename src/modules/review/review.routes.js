const express = require('express');
const router = express.Router();
const reviewController = require('./review.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/lookup', reviewController.getLookup);
router.get('/', reviewController.getAll);
router.get('/:id', reviewController.getOne);

// Public submission route
router.post('/submit', reviewController.create);

// Protected routes (Admin operations)
router.post('/', authenticate, reviewController.create);
router.put('/:id', authenticate, reviewController.update);
router.delete('/:id', authenticate, reviewController.delete);

module.exports = router;
