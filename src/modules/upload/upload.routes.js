const express = require('express');
const router = express.Router();
const uploadController = require('./upload.controller');
const { optionalAuth, authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Presigned URL generation for direct frontend image / video upload
router.post('/presigned-url', optionalAuth, uploadController.getPresignedUrl);

// File metadata & size check from Cloudflare R2
router.get('/file-info', optionalAuth, uploadController.getFileInfo);
router.post('/file-info', optionalAuth, uploadController.getFileInfo);

// Same-origin proxy for product media that can be read by browser tools & img tags
router.get('/file', optionalAuth, uploadController.getFile);

// File deletion endpoint (Admin only)
router.delete(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  uploadController.deleteFile
);

module.exports = router;
