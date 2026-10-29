const mongoose = require('mongoose');
const ApiError = require('../../utils/ApiError');
const { publicUrl } = require('../../utils/media');
const { WebsiteTheme } = require('./websiteTheme.model');
const Banner = require('../banner/banner.model');
const Category = require('../category/category.model');
const Featured = require('../featured/featured.model');

// ------------------------------- Theme Media Targets ----------------------------
// (Legacy ThemeMediaAsset collection removed in favor of ThemeMediaMapping)

// ------------------------------- Target Models Resolver ----------------------------
const getTargetModels = () => ({
  banner: Banner,
  category: Category,
  featured: Featured,
});

// ------------------------------- validate target ----------------------------
async function validateTarget(module, recordId, slot) {
  const models = getTargetModels();
  const Model = models[module];

  if (!Model || !mongoose.isValidObjectId(recordId)) {
    throw new ApiError(400, 'Invalid image target');
  }

  const record = await Model.findOne({ _id: recordId, 'meta.deletedAt': null }).lean();
  if (!record) {
    throw new ApiError(404, 'Save the record before adding theme images');
  }

  const allowed = module === 'category' ? ['banner', 'icon'] : ['image'];

  if (module === 'banner' && Array.isArray(record.collectionImages)) {
    record.collectionImages.forEach((image) => {
      allowed.push(`collection:${image._id}`);
    });
  }

  if (module === 'category' && Array.isArray(record.promoBanners)) {
    record.promoBanners.forEach((image) => {
      allowed.push(`promo:${image._id}`);
    });
  }

  if (!allowed.includes(slot)) {
    throw new ApiError(400, 'This image slot no longer exists');
  }

  return record;
}

// ------------------------------- save theme media ----------------------------
async function save(themeId, body, actorId) {
  const { module, recordId, slot, key } = body;
  await validateTarget(module, recordId, slot);

  if (!mongoose.isValidObjectId(themeId)) {
    throw new ApiError(400, 'Invalid theme');
  }

  const theme = await WebsiteTheme.findOne({ _id: themeId, status: 'draft', 'meta.deletedAt': null });
  if (!theme) {
    throw new ApiError(409, 'Only draft themes can receive images. Duplicate a published theme first.');
  }

  let asset = null;
  if (key) {
    if (typeof key !== 'string' || !/^website-themes\/[a-zA-Z0-9._/-]+$/.test(key) || key.includes('..')) {
      throw new ApiError(400, 'Invalid theme upload key');
    }
    asset = { _id: new mongoose.Types.ObjectId(), key, url: publicUrl(key) };
  }

  // Compare-and-swap prevents one uploader from silently overwriting another mapping.
  const previous = theme.config.mediaOverrides || [];
  const next = previous.filter(
    (row) => !(row.module === module && String(row.recordId) === recordId && row.slot === slot)
  );

  if (asset) {
    next.push({ module, recordId, slot, assetId: asset._id });
  }

  const unchanged = previous.length
    ? { 'config.mediaOverrides': previous }
    : { $or: [{ 'config.mediaOverrides': [] }, { 'config.mediaOverrides': { $exists: false } }] };

  const updated = await WebsiteTheme.findOneAndUpdate(
    { _id: themeId, status: 'draft', ...unchanged },
    {
      $set: {
        'config.mediaOverrides': next,
        'meta.updatedBy': actorId,
      },
    },
    { new: true, runValidators: true }
  );

  if (!updated) {
    throw new ApiError(409, 'Theme changed while uploading. Refresh and try again.');
  }

  await websiteThemeService.writeHistory(updated, 'updated', actorId, 'Theme image mapping updated.');

  return resolve(updated.config.toObject());
}

// ------------------------------- resolve theme media ----------------------------
async function resolve(config) {
  if (!config) return config;

  const rows = config.mediaOverrides || [];
  const byId = new Map();
  const records = new Map();
  const models = getTargetModels();

  await Promise.all(
    Object.entries(models).map(async ([module, Model]) => {
      const ids = rows.filter((row) => row.module === module).map((row) => row.recordId);
      if (!ids.length) return;

      const items = await Model.find({ _id: { $in: ids } })
        .select('name content.title display.type display.platform')
        .lean();

      items.forEach((item) => {
        const label =
          item.name ||
          item.content?.title ||
          `${item.display?.type || module} · ${item.display?.platform || ''}`;
        records.set(`${module}:${item._id}`, label);
      });
    })
  );

  const mediaOverrides = rows.map((row) => ({
    ...row,
    recordLabel: records.get(`${row.module}:${row.recordId}`) || 'Deleted record',
    asset: byId.get(String(row.assetId)) || null,
  }));

  const categoryAppearances = (config.categoryAppearances || []).map((category) => {
    const override = mediaOverrides.find(
      (row) => row.module === 'category' && row.slot === 'icon' && String(row.recordId) === String(category.categoryId)
    );
    return override?.asset
      ? { ...category, icon: { url: override.asset.url, key: override.asset.key } }
      : category;
  });

  return { ...config, mediaOverrides, categoryAppearances };
}

// ------------------------------- apply theme media ----------------------------
function apply(record, module, rows) {
  if (!record || typeof record !== 'object') return record;
  if (Array.isArray(record)) {
    return record.map((value) => apply(value, module, rows));
  }

  const result = { ...record };

  // The category display endpoint wraps category.banner in a synthetic Banner record.
  if (module === 'banner' && String(record._id || '').startsWith('category-banner-')) {
    const categoryId = String(record._id).slice('category-banner-'.length);
    const row = rows.find(
      (item) => item.module === 'category' && String(item.recordId) === categoryId && item.slot === 'banner' && item.asset?.url
    );
    if (row) {
      result.image = { url: row.asset.url, key: row.asset.key };
    }
  }

  for (const row of rows) {
    if (row.module !== module || String(row.recordId) !== String(record._id) || !row.asset?.url) {
      continue;
    }

    const media = { url: row.asset.url, key: row.asset.key };

    if (['banner', 'icon', 'image'].includes(row.slot)) {
      result[row.slot] = media;
      if (module === 'banner' && row.slot === 'image') {
        result.mediaType = 'image';
      }
    } else {
      const [kind, id] = row.slot.split(':');
      const field = kind === 'collection' ? 'collectionImages' : 'promoBanners';

      result[field] = (result[field] || []).map((item) => {
        if (String(item._id) !== id) return item;
        if (kind === 'collection') {
          return { ...item, ...media };
        }
        return { ...item, image: media, url: media.url };
      });
    }
  }

  // Response envelopes and nested category records keep their original structure.
  for (const key of Object.keys(result)) {
    if (result[key] && typeof result[key] === 'object') {
      result[key] = apply(result[key], module, rows);
    }
  }

  return result;
}

// ------------------------------- storefront middleware ----------------------------
function storefront(module) {
  return async (req, res, next) => {
    if (req.method !== 'GET' || req.query.themeMedia === 'false') {
      return next();
    }

    try {
      const themeMediaMappingService = require('./themeMediaMapping.service');
      const websiteThemeService = require('./websiteTheme.service');
      const publicConfig = await websiteThemeService.getPublicConfig();
      const rows = publicConfig.theme?.config?.mediaOverrides || [];
      const originalJson = res.json.bind(res);

      res.json = async function (body) {
        try {
          if (!body || typeof body !== 'object') {
            return originalJson(body);
          }

          let clonedBody = JSON.parse(JSON.stringify(body));

          // 1. Resolve dynamic ThemeMediaMapping records for the active theme
          if (Array.isArray(clonedBody.data)) {
            clonedBody.data = await themeMediaMappingService.resolveRecordsForStorefront(module, clonedBody.data);
          } else if (Array.isArray(clonedBody.data?.items)) {
            clonedBody.data.items = await themeMediaMappingService.resolveRecordsForStorefront(module, clonedBody.data.items);
          } else if (Array.isArray(clonedBody)) {
            clonedBody = await themeMediaMappingService.resolveRecordsForStorefront(module, clonedBody);
          } else if (clonedBody.data && typeof clonedBody.data === 'object' && clonedBody.data._id) {
            clonedBody.data = await themeMediaMappingService.resolveRecordsForStorefront(module, clonedBody.data);
          }

          // 2. Legacy fallback
          if (rows.length > 0) {
            clonedBody = apply(clonedBody, module, rows);
          }

          return originalJson(clonedBody);
        } catch (err) {
          console.error('[ThemeMedia storefront resolution error]', err);
          return originalJson(body);
        }
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  save,
  resolve,
  apply,
  validateTarget,
  storefront,
};
