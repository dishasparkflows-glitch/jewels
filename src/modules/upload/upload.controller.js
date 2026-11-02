const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const cloudflareR2 = require('../../utils/cloudflareR2');

// ------------------------------- get presigned url ----------------------------
const getPresignedUrl = catchAsync(async (req, res) => {
  const isDirectArray = Array.isArray(req.body);
  const body = isDirectArray ? {} : (req.body || {});
  const rawFiles = isDirectArray ? req.body : (body.files || body.items);
  const rawModule = body.module || body.folder || req.query?.module || req.query?.folder;
  const targetModule = rawModule || (isDirectArray && (rawFiles[0]?.module || rawFiles[0]?.folder));

  if (!targetModule && (!rawFiles || !rawFiles.length || !(rawFiles[0]?.module || rawFiles[0]?.folder))) {
    throw new ApiError(400, 'Module is required. Examples: "user", "category", "product", "navigation"');
  }
  const expiresIn = 3600;

  if (rawFiles !== undefined) {
    if (!Array.isArray(rawFiles) || rawFiles.length === 0) {
      throw new ApiError(400, 'Files must be a non-empty array');
    }

    const inferContentType = (file) => {
      const type = file.contentType || file.type;
      if (type && typeof type === 'string' && type.trim()) return type.trim().toLowerCase();
      const name = file.name || file.filename || '';
      if (/\.png$/i.test(name)) return 'image/png';
      if (/\.webp$/i.test(name)) return 'image/webp';
      if (/\.mp4$/i.test(name)) return 'video/mp4';
      if (/\.webm$/i.test(name)) return 'video/webm';
      if (/\.(mov|m4v)$/i.test(name)) return 'video/quicktime';
      if (/\.gif$/i.test(name)) return 'image/gif';
      if (/\.avif$/i.test(name)) return 'image/avif';
      return 'image/jpeg';
    };

    const results = await Promise.all(rawFiles.map(async (file, index) => {
      const itemModule = file.module || file.folder || targetModule;
      const itemProductId = file.productId || body.productId;
      const itemSubfolder = file.subfolder || body.subfolder;
      const itemContentType = inferContentType(file);

      const presigned = await cloudflareR2.getPresignedPutUrl({
        module: itemModule,
        contentType: itemContentType,
        productId: itemProductId,
        subfolder: itemSubfolder,
        expiresIn,
      });

      return {
        index,
        ...(file.name ? { name: file.name } : {}),
        ...presigned,
      };
    }));

    return ApiResponse.success(
      res,
      results,
      'Presigned upload URLs generated successfully',
      200
    );
  }

  const result = await cloudflareR2.getPresignedPutUrl({
    module: targetModule,
    contentType: body.contentType,
    productId: body.productId,
    subfolder: body.subfolder,
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
  const candidates = Array.isArray(keys) && keys.length ? keys : [key || filepath];

  if (Array.isArray(keys) && keys.length > 0) {
    await Promise.all(keys.map((k) => cloudflareR2.deleteFile(k)));
    return ApiResponse.success(res, null, `${keys.length} files deleted from Cloudflare R2 successfully`);
  }

  const target = key || filepath;
  if (!target) throw new ApiError(400, 'File path or key is required');

  await cloudflareR2.deleteFile(target);

  return ApiResponse.success(res, null, 'File deleted from Cloudflare R2 successfully');
});

// ------------------------------- get file info / size from R2 ----------------------------
const getFileInfo = catchAsync(async (req, res) => {
  const { key, url, keys, urls } = req.method === 'POST' ? req.body : req.query;
  const targetList = Array.isArray(keys) ? keys : Array.isArray(urls) ? urls : [key || url].filter(Boolean);

  if (targetList.length === 0) {
    throw new ApiError(400, 'File key or url is required');
  }

  if (targetList.length === 1 && !Array.isArray(keys) && !Array.isArray(urls)) {
    const meta = await cloudflareR2.getFileMetadata(targetList[0]);
    if (!meta) {
      throw new ApiError(404, 'File metadata could not be retrieved from Cloudflare R2');
    }
    return ApiResponse.success(res, { ...meta, requestedKey: targetList[0] }, 'File metadata retrieved successfully');
  }

  const results = await Promise.all(
    targetList.map(async (item) => {
      try {
        const meta = await cloudflareR2.getFileMetadata(item);
        return meta
          ? { ...meta, requestedKey: item }
          : { key: item, requestedKey: item, error: 'Could not fetch metadata' };
      } catch (err) {
        return { key: item, requestedKey: item, error: err.message };
      }
    })
  );

  return ApiResponse.success(res, results, 'Batch file metadata retrieved successfully');
});

module.exports = { getPresignedUrl, getFile, deleteFile, getFileInfo };
