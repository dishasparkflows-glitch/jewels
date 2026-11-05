const express = require('express');
const router = express.Router();
const commonController = require('./common.controller');

// Public storefront initialization endpoints
router.get('/bootstrap', commonController.getBootstrap);
router.get('/revision', commonController.getRevision);

module.exports = router;
