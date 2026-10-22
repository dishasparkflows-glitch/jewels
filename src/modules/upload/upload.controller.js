const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const cloudflareR2 = require('../../utils/cloudflareR2');

// ------------------------------- get presigned url ----------------------------
const getPresignedUrl = catchAsync(async (req, res) => {
  const { module: rawModule, folder, contentType, productId, subfolder, files } = req.body;
  const targetModule = rawModule || folder;

  if (!targetModule) {
    throw new ApiError(400, 'Module is required. Examples: "user", "category", "product", "navigation"');
  }
  const expiresIn = 3600;

  if (files !== undefined) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new ApiError(400, 'Files must be a non-empty array');
    }
    if (files.some((file) => !file || typeof file.contentType !== 'string' || !file.contentType.trim())) {
      throw new ApiError(400, 'Every file must include a contentType');
    }

    const results = await Promise.all(files.map(async (file, index) => ({
      index,
      ...(file.name ? { name: file.name } : {}),
      ...await cloudflareR2.getPresignedPutUrl({
        module: targetModule,
        contentType: file.contentType,
        productId,
        subfolder,
        expiresIn,
      }),
    })));

    return ApiResponse.success(
      res,
      results,
      'Presigned upload URLs generated successfully',
      200
    );
  }

  const result = await cloudflareR2.getPresignedPutUrl({
    module: targetModule,
    contentType,
    productId,
    subfolder,
    expiresIn,
  });

  return ApiResponse.success(
    res,
    result,
    'Presigned upload URL generated successfully',
    200
  );
});

const getFile = catchAsync(async (req, res) => {
  const key = typeof req.query.key === 'string' ? req.query.key : '';
  if (!key.startsWith('products/') || key.includes('..')) {
    throw new ApiError(400, 'A valid product media key is required');
  }

  const object = await cloudflareR2.getFile(key);
  if (object.ContentType) res.type(object.ContentType);
  if (object.ContentLength != null) res.set('Content-Length', String(object.ContentLength));
  res.set('Cache-Control', 'private, no-store');
  object.Body.pipe(res);
});

// ------------------------------- delete file ----------------------------
const deleteFile = catchAsync(async (req, res) => {
  const { filepath, key, keys } = req.body;
  if (Array.isArray(keys) && keys.length > 0) {
    await Promise.all(keys.map((k) => cloudflareR2.deleteFile(k)));
    return ApiResponse.success(res, null, `${keys.length} files deleted from Cloudflare R2 successfully`);
  }

  const target = key || filepath;
  if (!target) throw new ApiError(400, 'File path or key is required');

  await cloudflareR2.deleteFile(target);

  return ApiResponse.success(res, null, 'File deleted from Cloudflare R2 successfully');
});

module.exports = { getPresignedUrl, getFile, deleteFile };
