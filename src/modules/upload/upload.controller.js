const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const cloudflareR2 = require('../../utils/cloudflareR2');
const { ROLES } = require('../../config/constants');

const CUSTOMER_ALLOWED_MODULES = new Set(['users', 'reviews', 'custom-inquiries', 'custom-inquiry', 'review', 'user']);
const MAX_PRESIGNED_BATCH = 50;
const MAX_FILE_INFO_BATCH = 50;

const assertUploadModuleAllowed = (user, moduleName, contentType) => {
  const isAdmin = Boolean(user && [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(user.role));
  if (isAdmin) return;

  if (!user) {
    throw new ApiError(401, 'Authentication required');
  }

  const normalized = String(moduleName || '').trim().toLowerCase();
  if (!CUSTOMER_ALLOWED_MODULES.has(normalized)) {
    throw new ApiError(403, 'You do not have permission to upload to this module');
  }

  if (contentType && !String(contentType).trim().toLowerCase().startsWith('image/')) {
    throw new ApiError(400, 'Only image uploads are allowed');
  }
};

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
    if (rawFiles.length > MAX_PRESIGNED_BATCH) {
      throw new ApiError(400, `Cannot generate more than ${MAX_PRESIGNED_BATCH} presigned URLs per request`);
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

    const preparedFiles = rawFiles.map((file) => {
      const itemModule = file.module || file.folder || targetModule;
      const itemContentType = inferContentType(file);
      assertUploadModuleAllowed(req.user, itemModule, itemContentType);
      return {
        file,
        itemModule,
        itemProductId: file.productId || body.productId,
        itemSubfolder: file.subfolder || body.subfolder,
        itemContentType,
      };
    });

    const results = await Promise.all(preparedFiles.map(async (item, index) => {
      const presigned = await cloudflareR2.getPresignedPutUrl({
        module: item.itemModule,
        contentType: item.itemContentType,
        productId: item.itemProductId,
        subfolder: item.itemSubfolder,
        expiresIn,
      });

      return {
        index,
        ...(item.file.name ? { name: item.file.name } : {}),
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

  assertUploadModuleAllowed(req.user, targetModule, body.contentType);

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
  if (!/^products\/[a-zA-Z0-9._/-]+$/.test(key) || key.includes('..')) {
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
  const { key, keys } = req.body || {};
  const allKeys = Array.isArray(keys) ? keys : [];

  if (allKeys.length > 0) {
    await Promise.all(allKeys.map((k) => cloudflareR2.deleteFile(k)));
    return ApiResponse.success(res, null, `${allKeys.length} files deleted from Cloudflare R2 successfully`);
  }

  const target = key || req.query?.key;
  if (!target) throw new ApiError(400, 'File key is required');

  await cloudflareR2.deleteFile(target);

  return ApiResponse.success(res, null, 'File deleted from Cloudflare R2 successfully');
});

// ------------------------------- get file info / size from R2 ----------------------------
const getFileInfo = catchAsync(async (req, res) => {
  const { key, keys } = req.method === 'POST' ? req.body : req.query;
  const targetList = Array.isArray(keys) ? keys : [key].filter(Boolean);

  if (targetList.length === 0) {
    throw new ApiError(400, 'File key is required');
  }
  if (targetList.length > MAX_FILE_INFO_BATCH) {
    throw new ApiError(400, `Cannot query metadata for more than ${MAX_FILE_INFO_BATCH} files per request`);
  }

  if (targetList.length === 1 && !Array.isArray(keys)) {
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
