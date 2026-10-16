const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const path = require('path');
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const cloudflareR2 = require('../../utils/cloudflareR2');
const { publicUrl } = require('../../utils/media');

// ------------------------------- get presigned url ----------------------------
const getPresignedUrl = catchAsync(async (req, res) => {
  const { filename = 'asset.jpg', contentType = 'image/jpeg', folder = 'general' } = req.body;

  const result = await cloudflareR2.getPresignedPutUrl({
    filename,
    contentType,
    folder,
  });

  return ApiResponse.success(res, result, 'Presigned upload URL generated successfully', 200, { includeMediaKeys: true });
});

// ------------------------------- direct put upload ----------------------------
const directPut = catchAsync(async (req, res) => {
  const key = req.query.key;
  if (!key) throw new ApiError(400, 'Upload key is required');
  const contentType = req.headers['content-type'] || req.query.contentType || 'image/jpeg';

  let buffer;
  if (Buffer.isBuffer(req.body) && req.body.length > 0) {
    buffer = req.body;
  } else {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    buffer = Buffer.concat(chunks);
  }

  // Upload strictly to Cloudflare R2
  if (!cloudflareR2.isConfigured() || !cloudflareR2.client) {
    throw new ApiError(500, 'Cloudflare R2 storage is not configured');
  }

  const fileUrl = publicUrl(key);
  await cloudflareR2.client.send(
    new PutObjectCommand({
      Bucket: cloudflareR2.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );


  return ApiResponse.success(
    res,
    { url: fileUrl, fileUrl, key },
    'File uploaded to Cloudflare R2 successfully', 200, { includeMediaKeys: true }
  );
});

// ------------------------------- delete file ----------------------------
const deleteFile = catchAsync(async (req, res) => {
  const { filepath, key } = req.body;
  const target = key || filepath;
  if (!target) throw new ApiError(400, 'File path or key is required');

  await cloudflareR2.deleteFile(target);

  return ApiResponse.success(res, null, 'File deleted from Cloudflare R2 successfully');
});

// ------------------------------- serve / stream file from Cloudflare R2 ----------------------------
const serveFile = catchAsync(async (req, res) => {
  const rawKey = req.params[0] || req.query.key || '';
  const key = rawKey.replace(/^\/+/, '');
  if (!key) throw new ApiError(400, 'File key is required');

  // Stream directly from Cloudflare R2
  if (cloudflareR2.isConfigured() && cloudflareR2.client) {
    try {
      const command = new GetObjectCommand({
        Bucket: cloudflareR2.bucketName,
        Key: key,
      });
      const data = await cloudflareR2.client.send(command);

      const ext = path.extname(key).toLowerCase();
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.gif': 'image/gif',
        '.mp4': 'video/mp4',
        '.pdf': 'application/pdf',
      };
      const contentType = data.ContentType || mimeTypes[ext] || 'image/jpeg';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      if (data.ContentLength) {
        res.setHeader('Content-Length', data.ContentLength);
      }
      return data.Body.pipe(res);
    } catch (r2Err) {
      console.error(`Failed to stream "${key}" from Cloudflare R2:`, r2Err.message);
      return res.status(404).json({ success: false, message: 'File not found in storage' });
    }
  }

  return res.status(500).json({ success: false, message: 'Cloudflare R2 storage is not configured' });
});

module.exports = { getPresignedUrl, directPut, deleteFile, serveFile };
