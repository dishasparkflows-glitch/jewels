const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const cloudflareR2 = require('../../utils/cloudflareR2');

// ------------------------------- get presigned url ----------------------------
const getPresignedUrl = catchAsync(async (req, res) => {
  const { module: rawModule, folder, contentType, productId, files } = req.body;
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
    expiresIn,
  });

  return ApiResponse.success(
    res,
    result,
    'Presigned upload URL generated successfully',
    200
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

module.exports = { getPresignedUrl, deleteFile };
