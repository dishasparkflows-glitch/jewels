const express = require('express');
const router = express.Router();
const uploadController = require('./upload.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../config/constants');

// Presigned URL generation for authenticated uploads (admin for catalog/themes, users for customer modules)
router.post('/presigned-url', authenticate, uploadController.getPresignedUrl);

// File metadata & size check from Cloudflare R2 (Admin only)
router.get(
  '/file-info',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  uploadController.getFileInfo
);
router.post(
  '/file-info',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  uploadController.getFileInfo
);

// Same-origin proxy for public product media read by browser tools & img tags
router.get('/file', uploadController.getFile);

// File deletion endpoint (Admin only)
router.delete(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  uploadController.deleteFile
);

module.exports = router;
