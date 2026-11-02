const express = require('express');
const router = express.Router();
const uploadController = require('./upload.controller');
const { optionalAuth, authenticate } = require('../../middleware/auth.middleware');

// Presigned URL generation for direct frontend image / video upload
router.post('/presigned-url', optionalAuth, uploadController.getPresignedUrl);

// File metadata & size check from Cloudflare R2
router.get('/file-info', optionalAuth, uploadController.getFileInfo);
router.post('/file-info', optionalAuth, uploadController.getFileInfo);

// Same-origin proxy for product media that can be read by browser tools & img tags
router.get('/file', optionalAuth, uploadController.getFile);

// File deletion endpoint
router.delete('/', authenticate, uploadController.deleteFile);

module.exports = router;
