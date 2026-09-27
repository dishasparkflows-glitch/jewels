const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const path = require('path');
const fs = require('fs');

// ------------------------------- upload single file ----------------------------
const uploadSingle = catchAsync(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file uploaded');

  const fileUrl = `/uploads/${req.query.folder || 'general'}/${req.file.filename}`;
  return ApiResponse.success(res, {
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    url: fileUrl,
  }, 'File uploaded successfully');
});

// ------------------------------- upload multiple files ----------------------------
const uploadMultiple = catchAsync(async (req, res) => {
  if (!req.files || req.files.length === 0) throw new ApiError(400, 'No files uploaded');

  const files = req.files.map((file) => ({
    filename: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    url: `/uploads/${req.query.folder || 'general'}/${file.filename}`,
  }));

  return ApiResponse.success(res, files, 'Files uploaded successfully');
});

// ------------------------------- delete file ----------------------------
const deleteFile = catchAsync(async (req, res) => {
  const { filepath } = req.body;
  if (!filepath) throw new ApiError(400, 'File path is required');

  const fullPath = path.join(__dirname, '../../../', filepath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }

  return ApiResponse.success(res, null, 'File deleted successfully');
});

// ------------------------------- get presigned url ----------------------------
const cloudflareR2 = require('../../utils/cloudflareR2');

const getPresignedUrl = catchAsync(async (req, res) => {
  const filename = req.body.filename || req.query.filename || 'asset.jpg';
  const contentType = req.body.contentType || req.query.contentType || 'image/jpeg';
  const folder = req.body.folder || req.query.folder || 'banners';

  const result = await cloudflareR2.getPresignedPutUrl({
    filename,
    contentType,
    folder,
  });

  return ApiResponse.success(res, result, 'Presigned upload URL generated successfully');
});

// ------------------------------- direct put upload ----------------------------
const directPut = catchAsync(async (req, res) => {
  const key = req.query.key;
  if (!key) throw new ApiError(400, 'Upload key is required');

  const fullPath = path.join(__dirname, '../../../uploads', key);
  const dir = path.dirname(fullPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const writeStream = fs.createWriteStream(fullPath);
  req.pipe(writeStream);

  writeStream.on('finish', () => {
    return ApiResponse.success(
      res,
      { url: `/uploads/${key}`, key },
      'File uploaded directly via PUT successfully'
    );
  });

  writeStream.on('error', (err) => {
    throw new ApiError(500, `Direct upload failed: ${err.message}`);
  });
});

module.exports = { uploadSingle, uploadMultiple, deleteFile, getPresignedUrl, directPut };
