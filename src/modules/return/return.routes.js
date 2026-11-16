const express = require('express');
const router = express.Router();
const returnController = require('./return.controller');
const { authenticate } = require('../../middleware/auth.middleware');

router.use(authenticate);

router.post('/', returnController.createReturn);
router.get('/', returnController.getAllReturns);
router.get('/my', returnController.getMyReturns);
router.get('/:id', returnController.getReturnById);
router.patch('/:id/status', returnController.updateReturnStatus);

module.exports = router;
