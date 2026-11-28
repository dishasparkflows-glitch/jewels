const mongoose = require('mongoose');
const Product = require('./product.model');
const { loadPricingMasters, calculateProductPricing } = require('./product.pricing');
const productService = require('./product.service');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const catchAsync = require('../../utils/catchAsync');
const redisClient = require('../../utils/redisClient');

const RECOMPUTE_SECRET_KEY = process.env.RECOMPUTE_SECRET_KEY || 'rare3000';
const BACKUP_LATEST_COLLECTION = 'products_backup_latest';
const MAX_ERRORS_LOGGED = 50;

const idStr = (val) => String(val?._id || val || '');

const formatBackupTimestamp = (date = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('_') + '_' + [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join('');
};

const createInitialJobState = () => ({
  isRunning: false,
  done: false,
  phase: 'idle',
  error: null,
  total: 0,
  processed: 0,
  updatedCount: 0,
  skippedCount: 0,
  errorCount: 0,
  currentSku: '',
  currentTitle: '',
  backupInfo: null,
  errors: [],
  startedAt: null,
  finishedAt: null,
});

let jobState = createInitialJobState();

const getDbName = () =>
  mongoose.connection?.db?.databaseName || mongoose.connection?.name || 'unknown';

const verifyPasskey = (passkey) => {
  if (!passkey || String(passkey).trim() !== RECOMPUTE_SECRET_KEY) {
    throw new ApiError(403, 'Invalid passkey');
  }
};

const invalidateAllProductCaches = async () => {
  productService._invalidateProductCaches();
  try {
    await redisClient.deleteByPattern('products:*');
  } catch (err) {
    // Ignore cache clear failures when Redis is unavailable
  }
};

const findCenterMasterMatch = (row, centerRates = []) => {
  const typeId = idStr(row.diamondTypeId);
  const shapeId = idStr(row.diamondShapeId);
  const clarityId = idStr(row.diamondClarityId);
  const colorId = idStr(row.diamondColorId);
  const caratWeight = Number(row.caratWeight || 0);

  if (!typeId || !clarityId || !colorId) return null;

  const baseMatches = centerRates.filter(
    (r) =>
      idStr(r.diamondTypeId) === typeId &&
      (!shapeId || !r.diamondShapeId || idStr(r.diamondShapeId) === shapeId) &&
      idStr(r.diamondClarityId) === clarityId &&
      idStr(r.diamondColorId) === colorId
  );

  if (!baseMatches.length) return null;

  const rangeMatch = baseMatches.find(
    (r) => caratWeight >= Number(r.sizeFrom || 0) && caratWeight <= Number(r.sizeTo || 0)
  );
  return rangeMatch || baseMatches[0];
};

const findSideMasterMatch = (row, sideRates = []) => {
  const typeId = idStr(row.diamondTypeId);
  const shapeId = idStr(row.diamondShapeId);
  const clarityId = idStr(row.diamondClarityId);
  const colorId = idStr(row.diamondColorId);
  const pieces = Math.max(1, Number(row.pieces || 1));
  const caratWeight = Number(row.caratWeight || 0);
  const perPieceCarat = caratWeight / pieces;
  const hasExplicitRange =
    row.sizeFrom !== undefined &&
    row.sizeTo !== undefined &&
    row.sizeFrom !== '' &&
    row.sizeTo !== '';

  if (!typeId) return null;

  const exact = sideRates.find(
    (r) =>
      idStr(r.diamondTypeId) === typeId &&
      (!shapeId || !r.diamondShapeId || idStr(r.diamondShapeId) === shapeId) &&
      (!clarityId || !r.diamondClarityId || idStr(r.diamondClarityId) === clarityId) &&
      (!colorId || !r.diamondColorId || idStr(r.diamondColorId) === colorId) &&
      (hasExplicitRange
        ? Number(r.sizeFrom) === Number(row.sizeFrom) && Number(r.sizeTo) === Number(row.sizeTo)
        : perPieceCarat >= Number(r.sizeFrom || 0) && perPieceCarat <= Number(r.sizeTo || 0))
  );
  if (exact) return exact;

  return (
    sideRates.find(
      (r) =>
        idStr(r.diamondTypeId) === typeId &&
        (hasExplicitRange
          ? Number(r.sizeFrom) === Number(row.sizeFrom) && Number(r.sizeTo) === Number(row.sizeTo)
          : perPieceCarat >= Number(r.sizeFrom || 0) && perPieceCarat <= Number(r.sizeTo || 0))
    ) || null
  );
};

async function createSafetySnapshots() {
  const rawDb = mongoose.connection.db;
  if (!rawDb) {
    throw new Error('MongoDB connection is not ready');
  }
  const collectionName = Product.collection.collectionName;
  const tsCollection = `products_backup_${formatBackupTimestamp()}`;
  const totalDocs = await rawDb.collection(collectionName).countDocuments();

  await rawDb
    .collection(collectionName)
    .aggregate([{ $match: {} }, { $out: tsCollection }])
    .toArray();
  await rawDb
    .collection(collectionName)
    .aggregate([{ $match: {} }, { $out: BACKUP_LATEST_COLLECTION }])
    .toArray();

  return {
    collection: tsCollection,
    latest: BACKUP_LATEST_COLLECTION,
    count: totalDocs,
    createdAt: new Date().toISOString(),
  };
}

async function runRecomputeWorker() {
  try {
    // STEP 0: Two-tier safety backup before touching any product document
    jobState.phase = 'backup';
    jobState.backupInfo = await createSafetySnapshots();

    // STEP 1: Load pricing masters once
    jobState.phase = 'loading_masters';
    const masters = await loadPricingMasters();

    // STEP 2: Load all non-deleted active jewellery products (skip silver & ornate ERP)
    const filter = {
      productType: { $ne: 'silver' },
      isOrnate: { $ne: true },
      'meta.deletedAt': null,
    };
    const products = await Product.find(filter).lean();
    jobState.total = products.length;
    jobState.phase = 'processing';

    // STEP 3: Loop & recalculate each product
    for (const rawProduct of products) {
      const prodObj = { ...rawProduct };
      jobState.currentSku = prodObj.basicInfo?.sku || '';
      jobState.currentTitle = prodObj.basicInfo?.title || 'Untitled Product';

      try {
        if (!Array.isArray(prodObj.variants) || prodObj.variants.length === 0) {
          jobState.skippedCount += 1;
          jobState.processed += 1;
          continue;
        }

        // 3A: Refresh centerDiamondRows rates from CenterDiamondPrice master (preserve manual rows)
        if (Array.isArray(prodObj.centerDiamondRows) && prodObj.centerDiamondRows.length > 0) {
          prodObj.centerDiamondRows = prodObj.centerDiamondRows.map((row) => {
            if (row.rateSource === 'manual') return row;
            const match = findCenterMasterMatch(row, masters.centerRates);
            if (match && Number(match.priceINR) > 0) {
              return { ...row, pricePerCarat: Number(match.priceINR) };
            }
            return row;
          });
        }

        // 3B: Refresh sideDiamondRows rates from SideDiamondPrice master (preserve manual rows)
        if (Array.isArray(prodObj.sideDiamondRows) && prodObj.sideDiamondRows.length > 0) {
          prodObj.sideDiamondRows = prodObj.sideDiamondRows.map((row) => {
            if (row.rateSource === 'manual') return row;
            const match = findSideMasterMatch(row, masters.sideRates);
            if (match && Number(match.priceINR) > 0) {
              return { ...row, priceINR: Number(match.priceINR) };
            }
            return row;
          });
        }

        // 3C: Enforce fixed 3,000 / ct on color stone rows & side color stone rows
        if (Array.isArray(prodObj.colorStoneRows) && prodObj.colorStoneRows.length > 0) {
          prodObj.colorStoneRows = prodObj.colorStoneRows.map((r) => ({
            ...r,
            pricePerCarat: 3000,
          }));
        }
        if (Array.isArray(prodObj.sideColorStoneRows) && prodObj.sideColorStoneRows.length > 0) {
          prodObj.sideColorStoneRows = prodObj.sideColorStoneRows.map((r) => ({
            ...r,
            pricePerCarat: 3000,
          }));
        }

        // 3D: Normalize stone configuration & recompute all variants + salePrice
        productService.normalizeStoneConfig(prodObj);
        const pricingResult = calculateProductPricing(prodObj, masters);

        if (!pricingResult || !Array.isArray(pricingResult.variants) || pricingResult.variants.length === 0) {
          jobState.skippedCount += 1;
          jobState.processed += 1;
          continue;
        }

        // 3E: Persist refreshed stone rows, recomputed variants (with isCalculated: true), and salePrice
        await Product.updateOne(
          { _id: prodObj._id },
          {
            $set: {
              stoneConfigType: prodObj.stoneConfigType || 'centerDiamond',
              centerDiamondRows: prodObj.centerDiamondRows || [],
              colorStoneRows: prodObj.colorStoneRows || [],
              sideStoneConfigType: prodObj.sideStoneConfigType || 'none',
              sideDiamondRows: prodObj.sideDiamondRows || [],
              sideColorStoneRows: prodObj.sideColorStoneRows || [],
              variants: pricingResult.variants,
              'pricing.salePrice': pricingResult.salePrice || 0,
              'meta.updatedAt': new Date(),
            },
          }
        );

        jobState.updatedCount += 1;
      } catch (err) {
        jobState.errorCount += 1;
        if (jobState.errors.length < MAX_ERRORS_LOGGED) {
          jobState.errors.push({
            id: String(prodObj._id),
            sku: prodObj.basicInfo?.sku || '',
            title: prodObj.basicInfo?.title || 'Untitled Product',
            message: err.message || 'Unknown error',
          });
        }
      }

      jobState.processed += 1;
    }

    await invalidateAllProductCaches();

    jobState.phase = 'done';
    jobState.done = true;
    jobState.isRunning = false;
    jobState.currentSku = '';
    jobState.currentTitle = '';
    jobState.finishedAt = new Date().toISOString();
  } catch (err) {
    jobState.phase = 'failed';
    jobState.error = err.message || 'Fatal recompute error';
    jobState.done = true;
    jobState.isRunning = false;
    jobState.finishedAt = new Date().toISOString();
  }
}

class RecomputeController {
  // ------------------------------- get recompute status -----------------------
  getRecomputeStatus = catchAsync(async (req, res) => {
    let hasLatestBackup = false;
    try {
      const rawDb = mongoose.connection?.db;
      if (rawDb) {
        const cols = await rawDb.listCollections({ name: BACKUP_LATEST_COLLECTION }).toArray();
        hasLatestBackup = cols.length > 0;
      }
    } catch {
      hasLatestBackup = false;
    }

    return ApiResponse.success(
      res,
      {
        database: getDbName(),
        hasLatestBackup,
        status: jobState,
      },
      'Recompute status retrieved successfully'
    );
  });

  // ------------------------------- start background recompute -----------------
  startRecomputeAndPublishAll = catchAsync(async (req, res) => {
    verifyPasskey(req.body?.passkey);

    if (jobState.isRunning) {
      throw new ApiError(409, 'A catalogue recompute job is already running');
    }

    jobState = {
      ...createInitialJobState(),
      isRunning: true,
      phase: 'backup',
      startedAt: new Date().toISOString(),
    };

    // Fire-and-forget async worker so HTTP request returns immediately
    setImmediate(() => {
      runRecomputeWorker().catch((err) => {
        jobState.phase = 'failed';
        jobState.error = err?.message || 'Unexpected worker crash';
        jobState.isRunning = false;
        jobState.done = true;
        jobState.finishedAt = new Date().toISOString();
      });
    });

    return ApiResponse.success(
      res,
      {
        started: true,
        database: getDbName(),
        status: jobState,
      },
      'Catalogue recompute & publish started in background'
    );
  });

  // ------------------------------- reset job state ----------------------------
  resetRecomputeStatus = catchAsync(async (req, res) => {
    if (jobState.isRunning) {
      throw new ApiError(409, 'Cannot reset status while recompute job is running');
    }

    jobState = createInitialJobState();
    return ApiResponse.success(
      res,
      {
        database: getDbName(),
        status: jobState,
      },
      'Recompute status reset cleanly'
    );
  });

  // ------------------------------- rollback from latest backup ----------------
  restoreLastBackup = catchAsync(async (req, res) => {
    verifyPasskey(req.body?.passkey);

    if (jobState.isRunning) {
      throw new ApiError(409, 'Cannot restore backup while recompute job is running');
    }

    const rawDb = mongoose.connection?.db;
    if (!rawDb) {
      throw new ApiError(500, 'Database connection is unavailable');
    }

    const backupExists = await rawDb
      .listCollections({ name: BACKUP_LATEST_COLLECTION })
      .toArray();
    if (!backupExists.length) {
      throw new ApiError(404, 'No backup snapshot found (products_backup_latest missing)');
    }

    const backupCount = await rawDb.collection(BACKUP_LATEST_COLLECTION).countDocuments();
    if (!backupCount) {
      throw new ApiError(400, 'Backup snapshot is empty; restore aborted to protect catalogue');
    }

    const productsCollection = Product.collection.collectionName;
    await rawDb
      .collection(BACKUP_LATEST_COLLECTION)
      .aggregate([{ $match: {} }, { $out: productsCollection }])
      .toArray();

    await invalidateAllProductCaches();

    return ApiResponse.success(
      res,
      {
        database: getDbName(),
        sourceCollection: BACKUP_LATEST_COLLECTION,
        restoredCount: backupCount,
      },
      `Restored ${backupCount} products from ${BACKUP_LATEST_COLLECTION}`
    );
  });
}

module.exports = new RecomputeController();
