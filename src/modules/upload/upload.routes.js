const express = require('express');
const router = express.Router();
const uploadController = require('./upload.controller');
const upload = require('./upload.service');
const { authenticate } = require('../../middleware/auth.middleware');

// Direct PUT stream upload endpoint (emulates Cloudflare R2 / S3 presigned PUT bucket URL)
router.put('/direct-put', uploadController.directPut);

router.use(authenticate);

router.post('/single', upload.single('file'), uploadController.uploadSingle);
router.post('/multiple', upload.array('files', 10), uploadController.uploadMultiple);
router.post('/presigned-url', uploadController.getPresignedUrl);
router.get('/presigned-url', uploadController.getPresignedUrl);
router.delete('/', uploadController.deleteFile);

module.exports = router;
