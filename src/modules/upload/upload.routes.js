const express = require('express');
const router = express.Router();
const uploadController = require('./upload.controller');
const { optionalAuth, authenticate } = require('../../middleware/auth.middleware');

// Stream / serve file from Cloudflare R2 (public GET, no auth required)
router.get('/file/*', uploadController.serveFile);

// Presigned URL generation for direct frontend image / video upload
router.post('/presigned-url', optionalAuth, uploadController.getPresignedUrl);

// File deletion endpoint
router.delete('/', authenticate, uploadController.deleteFile);

module.exports = router;
