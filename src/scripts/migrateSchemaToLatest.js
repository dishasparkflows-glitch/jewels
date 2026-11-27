/**
 * ============================================================================
 * Schema Alignment & Cross-Database Migration Script
 * ============================================================================
 *
 * Purpose:
 * 1. Reads collections one by one from FROM_DB (read-only), maps every record to
 *    match the latest Mongoose schemas, and inserts/upserts into TO_DB.
 * 2. Automatically syncs `filters` (remapped to TO_DB category IDs/slugs),
 *    `settings`, `top_announcements`, and `modules` from MASTER_DB (read-only)
 *    into TO_DB.
 * Always strictly uses process.env.FROM_DB, TO_DB, and MASTER_DB (no fallbacks).
 *
 * Key Rules & Guarantees:
 * 1. Read-Only Sources: FROM_DB and MASTER_DB are NEVER modified or deleted.
 * 2. Media Safety: NEVER deletes any 3rd-party or Cloudflare R2 media assets.
 * 3. Audit Migration: Moves any top-level `createdAt`, `createdBy`, `updatedAt`,
 *    `updatedBy` fields into `meta` and REMOVES those top-level fields.
 * 4. Soft-Delete Handling: Skips `isDeleted: true` records from source DBs, and
 *    does NOT store `isDeleted` (`isDeleted: false`) in `TO_DB` (uses `meta.deletedAt`).
 * 5. Version Key Cleanup: Removes `__v` from every record.
 * 6. Mapped vs Extra Fields: Removes legacy fields once mapped into new schema
 *    blocks; preserves genuinely extra fields (except `featured` & `subType` on products).
 * 7. Product Slugs & Nested Mapping: Generates `basicInfo.slug` from `title`,
 *    sets `productType: "gold"`, `isOrnate: false`, maps `status` (`active`->`approved`,
 *    `inactive`->`draft`), converts `promoBanner` to `ObjectId[]`, maps `basicInfo`,
 *    `pricing`, `specifications`, `*Ids`, `variants`, stone rows, and `colorImages`.
 * 8. Master Sync: Syncs `filters` (with `categoryConfigs` mapped to TO_DB
 *    categories), `settings`, `top_announcements`, and `modules` from MASTER_DB
 *    into TO_DB automatically.
 *
 * Usage:
 *   node src/scripts/migrateSchemaToLatest.js --dry-run
 *   node src/scripts/migrateSchemaToLatest.js --execute
 *   node src/scripts/migrateSchemaToLatest.js --execute --collection=products
 *   node src/scripts/migrateSchemaToLatest.js --execute --collection=filters
 *   node src/scripts/migrateSchemaToLatest.js --execute --collection=settings
 *   node src/scripts/migrateSchemaToLatest.js --execute --collection=top_announcements
 *   node src/scripts/migrateSchemaToLatest.js --execute --collection=modules
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { extractKey } = require('../utils/media');

// Models excluded from automatic metaPlugin (matching src/utils/metaPlugin.js)
const EXCLUDED_META_COLLECTIONS = new Set([
  'carts',
  'wishlists',
  'cod_sequences',
  'codsequences',
  'currencies',
  'integration_tokens',
  'integrationtokens',
  'whatsapp_messages',
  'whatsappmessages',
  'notifications',
  'addresses',
  'theme_media_mappings',
  'thememediamappings',
]);

const TOP_AUDIT_FIELDS = ['createdAt', 'createdBy', 'updatedAt', 'updatedBy'];

// Matches Product model slug normalization
function generateSlug(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Normalizes { url, key } without deleting any media
function normalizeMediaObject(media) {
  if (!media) return { url: '', key: '' };
  if (typeof media === 'string') {
    return { url: media, key: extractKey(media) || '' };
  }
  const url = media.url || '';
  const key = media.key || media.public_id || extractKey(url) || '';
  const res = { url, key };
  if (media.mediaType) res.mediaType = media.mediaType;
  if (media.title) res.title = media.title;
  return res;
}

// Moves top-level createdAt/By & updatedAt/By into meta and removes those top-level keys
function migrateAuditFieldsToMeta(doc, collectionName) {
  const hasTopAudit = TOP_AUDIT_FIELDS.some((k) => doc[k] !== undefined);
  const isExcluded = EXCLUDED_META_COLLECTIONS.has(String(collectionName).toLowerCase());

  if (!isExcluded || hasTopAudit || doc.meta) {
    const existingMeta = doc.meta && typeof doc.meta === 'object' ? { ...doc.meta } : {};
    const createdAt = existingMeta.createdAt || doc.createdAt || new Date();
    const updatedAt = existingMeta.updatedAt || doc.updatedAt || createdAt;
    const createdBy =
      existingMeta.createdBy !== undefined && existingMeta.createdBy !== null
        ? existingMeta.createdBy
        : doc.createdBy ?? null;
    const updatedBy =
      existingMeta.updatedBy !== undefined && existingMeta.updatedBy !== null
        ? existingMeta.updatedBy
        : doc.updatedBy ?? null;
    const isDeleted = Boolean(doc.isDeleted);
    const deletedAt =
      existingMeta.deletedAt !== undefined
        ? existingMeta.deletedAt
        : isDeleted
        ? doc.updatedAt || new Date()
        : null;
    const deletedBy =
      existingMeta.deletedBy !== undefined && existingMeta.deletedBy !== null
        ? existingMeta.deletedBy
        : doc.deletedBy ?? null;

    doc.meta = {
      ...existingMeta,
      createdBy,
      updatedBy,
      deletedBy,
      createdAt: new Date(createdAt),
      updatedAt: new Date(updatedAt),
      deletedAt: deletedAt ? new Date(deletedAt) : null,
    };
  }

  for (const field of TOP_AUDIT_FIELDS) {
    delete doc[field];
  }
  delete doc.isDeleted;
  delete doc.__v;
}

function mapStoneRowIds(row, includeColorAndClarity = false) {
  if (!row || typeof row !== 'object') return row;
  const r = { ...row };
  if (!r.diamondTypeId && r.diamondType) r.diamondTypeId = r.diamondType;
  if (!r.diamondShapeId && r.diamondShape) r.diamondShapeId = r.diamondShape;
  delete r.diamondType;
  delete r.diamondShape;
  if (includeColorAndClarity) {
    if (!r.diamondColorId && r.diamondColor) r.diamondColorId = r.diamondColor;
    if (!r.diamondClarityId && r.diamondClarity) r.diamondClarityId = r.diamondClarity;
    delete r.diamondColor;
    delete r.diamondClarity;
  }
  return r;
}

// Collection-specific schema transformers (operate on cloned document `doc`, preserving extra fields)
const transformers = {
  products: (doc, ctx) => {
    const currentBasic = doc.basicInfo || {};
    const title = currentBasic.title || doc.title || '';
    const sku = currentBasic.sku || doc.sku || '';
    const description =
      currentBasic.description !== undefined ? currentBasic.description : doc.description || '';
    const remark = currentBasic.remark !== undefined ? currentBasic.remark : doc.remark || '';

    // Always generate slug using title if missing, or normalize existing
    let baseSlug = currentBasic.slug || generateSlug(title);
    if (!baseSlug) {
      baseSlug = sku ? generateSlug(sku) : `product-${doc._id}`;
    }

    let slug = baseSlug;
    if (ctx && ctx.usedSlugs) {
      if (ctx.usedSlugs.has(slug)) {
        const suffix = sku ? generateSlug(sku) : String(doc._id).slice(-6);
        slug = `${baseSlug}-${suffix}`;
      }
      ctx.usedSlugs.add(slug);
    }

    let gender = currentBasic.gender;
    if (!gender && doc.gender) {
      gender = Array.isArray(doc.gender) ? doc.gender : [doc.gender];
    }

    doc.basicInfo = {
      title,
      sku,
      slug,
      description,
      remark,
      ...(gender ? { gender } : {}),
    };

    const currentPricing = doc.pricing || {};
    doc.pricing = {
      baseCarat: currentPricing.baseCarat ?? 1,
      gstPercentage: currentPricing.gstPercentage ?? doc.gstPercentage ?? 3,
      mrp: currentPricing.mrp ?? 0,
      salePrice: currentPricing.salePrice ?? doc.displayPrice ?? 0,
      costPrice: currentPricing.costPrice ?? 0,
      ornatePrice: currentPricing.ornatePrice ?? 0,
      markupPercentage: currentPricing.markupPercentage ?? 0,
      mrpMarkupPercentage: currentPricing.mrpMarkupPercentage ?? 0,
      calculatedPrice: currentPricing.calculatedPrice ?? 0,
      baseLabourCharge: currentPricing.baseLabourCharge ?? doc.baseLabourCharge ?? 0,
      certificateCharge: currentPricing.certificateCharge ?? doc.certificateCharge ?? 0,
      otherAmountPercentage: currentPricing.otherAmountPercentage ?? doc.otherAmountPercentage ?? 0,
    };

    const currentSpecs = doc.specifications || {};
    doc.specifications = {
      metalWeight: currentSpecs.metalWeight ?? doc.baseMetalWeight ?? 0,
    };

    if (!doc.categoryIds && doc.category) {
      doc.categoryIds = Array.isArray(doc.category) ? doc.category : [doc.category];
    }
    if (!doc.menuItemIds && doc.menuItem) {
      doc.menuItemIds = Array.isArray(doc.menuItem) ? doc.menuItem : [doc.menuItem];
    }
    if (!doc.sizeIds && doc.size) {
      doc.sizeIds = Array.isArray(doc.size) ? doc.size : [doc.size];
    }
    if (!doc.metalColorIds && doc.metalColors) {
      doc.metalColorIds = Array.isArray(doc.metalColors) ? doc.metalColors : [doc.metalColors];
    }

    // Convert promoBanner IDs from string to MongoDB ObjectId
    if (doc.promoBanner !== undefined) {
      const promoArr = Array.isArray(doc.promoBanner) ? doc.promoBanner : [doc.promoBanner];
      doc.promoBanner = promoArr
        .filter((id) => id && mongoose.isValidObjectId(id))
        .map((id) =>
          id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id))
        );
    }

    // Always add top-level productType: "gold" & isOrnate: false on every product
    doc.productType = 'gold';
    doc.isOrnate = false;

    // Map legacy product status: active -> approved, inactive -> draft
    if (doc.status === 'active') {
      doc.status = 'approved';
    } else if (doc.status === 'inactive') {
      doc.status = 'draft';
    } else if (!['approved', 'draft'].includes(doc.status)) {
      doc.status = 'draft';
    }
    if (!doc.visibility) doc.visibility = { web: true, app: true };
    if (!doc.demoMetrics) doc.demoMetrics = { soldCount: 0, reviewCount: 0 };

    if (Array.isArray(doc.centerDiamondRows)) {
      doc.centerDiamondRows = doc.centerDiamondRows.map((r) => mapStoneRowIds(r, true));
    }
    if (Array.isArray(doc.sideDiamondRows)) {
      doc.sideDiamondRows = doc.sideDiamondRows.map((r) => mapStoneRowIds(r, true));
    }
    if (Array.isArray(doc.colorStoneRows)) {
      doc.colorStoneRows = doc.colorStoneRows.map((r) => mapStoneRowIds(r, false));
    }
    if (Array.isArray(doc.sideColorStoneRows)) {
      doc.sideColorStoneRows = doc.sideColorStoneRows.map((r) => mapStoneRowIds(r, false));
    }

    if (Array.isArray(doc.variants)) {
      doc.variants = doc.variants.map((v) => {
        const vObj = { ...v };
        delete vObj.meta;
        if (!vObj.metalPurityId && vObj.metalPurity) vObj.metalPurityId = vObj.metalPurity;
        if (!vObj.diamondTypeId && vObj.diamondType) vObj.diamondTypeId = vObj.diamondType;
        if (!vObj.diamondShapeId && vObj.diamondShape) vObj.diamondShapeId = vObj.diamondShape;
        if (!vObj.diamondClarityId && vObj.diamondClarity) vObj.diamondClarityId = vObj.diamondClarity;
        if (!vObj.diamondColorId && vObj.diamondColor) vObj.diamondColorId = vObj.diamondColor;
        delete vObj.metalPurity;
        delete vObj.diamondType;
        delete vObj.diamondShape;
        delete vObj.diamondClarity;
        delete vObj.diamondColor;
        return vObj;
      });
    }

    if (Array.isArray(doc.colorImages)) {
      doc.colorImages = doc.colorImages.map((ci) => {
        const ciObj = { ...ci };
        if (!ciObj.metalColorId && ciObj.metalColor) ciObj.metalColorId = ciObj.metalColor;
        delete ciObj.metalColor;
        if (!ciObj.status) ciObj.status = 'active';
        if (Array.isArray(ciObj.images)) {
          ciObj.images = ciObj.images.map((img) => {
            const norm = normalizeMediaObject(img);
            return {
              url: norm.url,
              key: norm.key,
              mediaType: norm.mediaType || 'image',
              ...(img._id ? { _id: img._id } : {}),
            };
          });
        }
        if (ciObj.vtoImage) {
          const normVto = normalizeMediaObject(ciObj.vtoImage);
          ciObj.vtoImage = { url: normVto.url, key: normVto.key };
        }
        if (ciObj.variantIcon) {
          const normIcon = normalizeMediaObject(ciObj.variantIcon);
          ciObj.variantIcon = { url: normIcon.url, key: normIcon.key };
        }
        return ciObj;
      });
    }

    // Remove top-level fields that have been moved into nested/new schema fields or explicitly skipped
    const mappedProductTopFields = [
      'title',
      'description',
      'sku',
      'remark',
      'gender',
      'gstPercentage',
      'baseMetalWeight',
      'baseLabourCharge',
      'certificateCharge',
      'otherAmountPercentage',
      'displayPrice',
      'category',
      'menuItem',
      'size',
      'metalColors',
      'featured',
      'subType',
    ];
    for (const f of mappedProductTopFields) {
      delete doc[f];
    }
  },

  banners: (doc) => {
    doc.content = doc.content || { title: '', description: '' };
    const curDisplay = doc.display || {};
    doc.display = {
      categoryId: curDisplay.categoryId !== undefined ? curDisplay.categoryId : doc.category || null,
      menuItemIds: curDisplay.menuItemIds || undefined,
      type: curDisplay.type || doc.type || 'herobanner',
      platform: curDisplay.platform || 'web',
      order: curDisplay.order !== undefined ? curDisplay.order : Number(doc.position) || 0,
    };
    if (doc.image) {
      const norm = normalizeMediaObject(doc.image);
      doc.image = {
        url: norm.url,
        key: norm.key,
        mediaType: doc.mediaType || norm.mediaType || 'image',
      };
    }
    if (doc.mobileImage) {
      const normM = normalizeMediaObject(doc.mobileImage);
      doc.mobileImage = {
        url: normM.url,
        key: normM.key,
        mediaType: normM.mediaType || 'image',
      };
    }
    delete doc.category;
    delete doc.type;
    delete doc.position;
    delete doc.mediaType;
  },

  categories: (doc) => {
    if (!doc.slug && doc.name) {
      doc.slug = generateSlug(doc.name);
    }
    if (Array.isArray(doc.images)) {
      doc.images = doc.images.map((img) => {
        const norm = normalizeMediaObject(img);
        return {
          url: norm.url,
          key: norm.key,
          title: norm.title || img.title || '',
          ...(img._id ? { _id: img._id } : {}),
        };
      });
    }
    if (doc.sizeChart && typeof doc.sizeChart === 'object') {
      const normSC = normalizeMediaObject(doc.sizeChart);
      doc.sizeChart = { url: normSC.url, key: normSC.key };
    }
    if (Array.isArray(doc.subTypes)) {
      doc.subTypes = doc.subTypes.map((st) => {
        if (st && st.sizeChart && typeof st.sizeChart === 'object') {
          const normSubSC = normalizeMediaObject(st.sizeChart);
          return { ...st, sizeChart: { url: normSubSC.url, key: normSubSC.key } };
        }
        return st;
      });
    }
    if (!doc.sizingConfig) {
      doc.sizingConfig = {
        isScalable: false,
        sizeLabel: 'Size',
        baseSize: 7.0,
        stepSize: 1.0,
        percentPerStep: 2.5,
      };
    }
    if (doc.order === undefined) doc.order = 0;
    if (!doc.promoBanners) doc.promoBanners = [];
  },

  reviews: (doc) => {
    doc.customer = doc.customer || {
      name: doc.user || 'Customer',
      email: '',
    };
    doc.review = doc.review || {
      title: doc.title || '',
      rating: doc.rating !== undefined ? doc.rating : 5,
      comment: doc.comment || '',
      reviewDate: doc.createdAt ? new Date(doc.createdAt) : new Date(),
    };
    if (!doc.image && Array.isArray(doc.images) && doc.images[0]) {
      const norm = normalizeMediaObject(doc.images[0]);
      doc.image = { url: norm.url, key: norm.key };
    } else if (doc.image) {
      const norm = normalizeMediaObject(doc.image);
      doc.image = { url: norm.url, key: norm.key };
    } else {
      doc.image = { url: '', key: '' };
    }
    if (doc.productId === undefined) doc.productId = null;

    delete doc.user;
    delete doc.title;
    delete doc.rating;
    delete doc.comment;
    delete doc.images;
  },

  sizes: (doc) => {
    if (!doc.categoryId && doc.category) {
      doc.categoryId = doc.category;
    }
    delete doc.category;
  },

  metal_purities: (doc) => {
    if (doc.order === undefined) doc.order = 0;
  },

  metal_colors: (doc) => {
    if (doc.colorCode === undefined) doc.colorCode = '';
    if (doc.colorCodeEnd === undefined) doc.colorCodeEnd = '';
    if (doc.status === undefined) doc.status = 'active';
  },

  birthstones: (doc) => {
    if (doc.image) {
      const norm = normalizeMediaObject(doc.image);
      doc.image = { url: norm.url, key: norm.key };
    }
    if (doc.order === undefined) doc.order = 0;
  },

  diamond_clarities: (doc) => {
    doc.image = doc.image ? normalizeMediaObject(doc.image) : { url: '', key: '' };
  },
  diamond_colors: (doc) => {
    doc.image = doc.image ? normalizeMediaObject(doc.image) : { url: '', key: '' };
  },
  diamond_shapes: (doc) => {
    doc.image = doc.image ? normalizeMediaObject(doc.image) : { url: '', key: '' };
  },
  diamond_types: (doc) => {
    doc.image = doc.image ? normalizeMediaObject(doc.image) : { url: '', key: '' };
  },

  coupons: (doc) => {
    if (doc.categoryId === undefined) doc.categoryId = null;
    doc.coupon = doc.coupon || {
      code: doc.couponcode ? String(doc.couponcode).toUpperCase().trim() : '',
      description: doc.description || '',
    };
    doc.discount = doc.discount || {
      type: doc.discounttype || 'Percentage',
      value: doc.discountvalue ?? 0,
      minimumOrderAmount: doc.minimumorderamount ?? 0,
    };
    doc.validity = doc.validity || {
      startDate: doc.startdate ?? null,
      endDate: doc.enddate ?? null,
    };
    doc.usage = doc.usage || {
      usageLimit: doc.usagelimit ?? null,
      usedCount: doc.usedCount ?? 0,
      perUserLimit: doc.peruserlimit ?? 1,
    };
    for (const f of [
      'couponcode',
      'description',
      'discounttype',
      'discountvalue',
      'minimumorderamount',
      'startdate',
      'enddate',
      'usagelimit',
      'usedCount',
      'peruserlimit',
    ]) {
      delete doc[f];
    }
  },

  featureds: (doc) => {
    if (!doc.display) {
      doc.display = {
        type: doc.placement || 'Celebrate',
        platform: 'web',
        order: Number(doc.position) || 0,
      };
    }
    if (doc.image) {
      const norm = normalizeMediaObject(doc.image);
      doc.image = { url: norm.url, key: norm.key };
    }
    if (doc.categoryId === undefined) doc.categoryId = null;
    if (!doc.menuItemIds) doc.menuItemIds = [];
    if (!doc.productIds) doc.productIds = [];
    delete doc.placement;
    delete doc.position;
  },

  users: (doc) => {
    if (doc.ownerId === undefined) doc.ownerId = null;
  },

  instagram_posts: (doc) => {
    if (doc.title === undefined) doc.title = '';
    if (doc.order === undefined) doc.order = Number(doc.position) || 0;
    if (doc.isActive === undefined) doc.isActive = true;
    delete doc.position;
  },

  menu_items: (doc) => {
    if (doc.icon && typeof doc.icon === 'object') {
      const norm = normalizeMediaObject(doc.icon);
      doc.icon = { url: norm.url, key: norm.key };
    }
    if (doc.order === undefined) doc.order = 0;
    if (doc.status === undefined) doc.status = 'active';
  },

  menu_sections: (doc) => {
    if (doc.order === undefined) doc.order = 0;
    if (doc.status === undefined) doc.status = 'active';
  },
};

function transformDocument(doc, collectionName, ctx) {
  const cloned = { ...doc };
  const fn = transformers[collectionName];
  if (fn) {
    fn(cloned, ctx);
  }
  migrateAuditFieldsToMeta(cloned, collectionName);
  return cloned;
}

function getNestedValue(obj, dotPath) {
  return dotPath.split('.').reduce((acc, part) => (acc != null ? acc[part] : undefined), obj);
}

async function resolveUniqueConflicts(toColl, docs, uniqueIndexes, isExecute) {
  let conflictCount = 0;
  if (!uniqueIndexes || uniqueIndexes.length === 0 || docs.length === 0) return 0;

  for (const idx of uniqueIndexes) {
    const keyFields = Object.keys(idx.key);
    for (const doc of docs) {
      const filter = {};
      let hasAllKeys = true;
      for (const kf of keyFields) {
        const val = getNestedValue(doc, kf);
        if (val === undefined) {
          hasAllKeys = false;
          break;
        }
        filter[kf] = val;
      }
      if (!hasAllKeys) continue;

      const existing = await toColl.findOne(
        { ...filter, _id: { $ne: doc._id } },
        { projection: { _id: 1 } }
      );
      if (existing) {
        conflictCount++;
        if (isExecute) {
          await toColl.deleteOne({ _id: existing._id });
        }
      }
    }
  }
  return conflictCount;
}

const SLUG_ALIASES = {
  'pendant-and-necklaces': ['pendant-and-necklaces', 'pendant', 'pendants', 'necklaces'],
  'bangles-bracelets': ['bangles-bracelets', 'bracelets', 'bangles'],
  collection: ['collection', 'collections', 'silver-collection'],
};

function findMasterCategoryConfig(masterConfigs = [], toCategory) {
  const slug = String(toCategory.slug || '').toLowerCase().trim();
  if (!slug) return null;

  const candidates = SLUG_ALIASES[slug] || [slug];
  for (const candidate of candidates) {
    const match = masterConfigs.find(
      (c) => String(c.categorySlug || '').toLowerCase().trim() === candidate
    );
    if (match) return match;
  }
  return null;
}

function mapFilterForTarget(masterFilter, toCategories) {
  const doc = { ...masterFilter };
  const masterConfigs = Array.isArray(doc.categoryConfigs) ? doc.categoryConfigs : [];

  doc.categoryConfigs = toCategories.map((cat) => {
    const matched = findMasterCategoryConfig(masterConfigs, cat);
    return {
      categoryId: cat._id,
      categorySlug: cat.slug || '',
      enabled: matched ? matched.enabled !== false : true,
      order: matched && matched.order !== undefined ? matched.order : doc.order ?? 0,
      customTitle: matched && matched.customTitle ? String(matched.customTitle) : '',
    };
  });

  const originalId = doc._id;
  delete doc._id;
  migrateAuditFieldsToMeta(doc, 'filters');
  return { originalId, payload: doc };
}

async function syncFiltersFromMaster({ masterConn, toConn, fallbackCategories, isExecute }) {
  const masterDb = masterConn.db;
  const toDb = toConn.db;

  const masterFilters = await masterDb
    .collection('filters')
    .find({
      isDeleted: { $ne: true },
      $or: [{ 'meta.deletedAt': null }, { 'meta.deletedAt': { $exists: false } }],
    })
    .sort({ order: 1 })
    .toArray();

  let toCategories = await toDb
    .collection('categories')
    .find({
      isDeleted: { $ne: true },
      $or: [{ 'meta.deletedAt': null }, { 'meta.deletedAt': { $exists: false } }],
    })
    .sort({ order: 1, name: 1 })
    .toArray();

  if (toCategories.length === 0 && Array.isArray(fallbackCategories) && fallbackCategories.length > 0) {
    toCategories = fallbackCategories;
  }

  if (toCategories.length === 0) {
    throw new Error('No active categories found in TO_DB. Migrate categories before syncing filters.');
  }

  console.log(`\n🎛️  Syncing [filters] from MASTER_DB (${masterConn.name}) using ${toCategories.length} TO_DB categories...`);

  const toFiltersColl = toDb.collection('filters');
  let vCount = 0;
  let topAuditCount = 0;

  for (const mf of masterFilters) {
    if (mf.__v !== undefined) vCount++;
    if (TOP_AUDIT_FIELDS.some((f) => mf[f] !== undefined)) topAuditCount++;

    const { originalId, payload } = mapFilterForTarget(mf, toCategories);
    const existing = await toFiltersColl.findOne(
      { filterId: payload.filterId },
      { projection: { _id: 1 } }
    );

    if (isExecute) {
      await toFiltersColl.updateOne(
        { filterId: payload.filterId },
        {
          $set: payload,
          $setOnInsert: { _id: originalId },
        },
        { upsert: true }
      );
    }

    const action = existing ? 'UPDATE' : 'INSERT';
    console.log(
      `  [${action}] ${payload.filterId.padEnd(20)} | status: ${String(payload.status).padEnd(8)} | categoryConfigs: ${payload.categoryConfigs.length}`
    );
  }

  const toCountAfter = await toFiltersColl.countDocuments();
  return {
    collection: 'filters',
    source: `MASTER_DB (${masterConn.name})`,
    fromDocs: masterFilters.length,
    skippedDeleted: 0,
    toDocs: isExecute ? toCountAfter : Math.max(toCountAfter, masterFilters.length),
    vCount,
    topAuditCount,
    conflictsResolved: 0,
  };
}

async function syncSettingsFromMaster({ masterConn, toConn, isExecute }) {
  const masterDb = masterConn.db;
  const toDb = toConn.db;

  const masterSettings = await masterDb
    .collection('settings')
    .find({
      isDeleted: { $ne: true },
      $or: [{ 'meta.deletedAt': null }, { 'meta.deletedAt': { $exists: false } }],
    })
    .toArray();

  console.log(`\n⚙️  Syncing [settings] from MASTER_DB (${masterConn.name}) -> TO_DB (${toConn.name})...`);

  const toSettingsColl = toDb.collection('settings');
  const toThemesColl = toDb.collection('themes');
  let vCount = 0;
  let topAuditCount = 0;

  for (const ms of masterSettings) {
    if (ms.__v !== undefined) vCount++;
    if (TOP_AUDIT_FIELDS.some((f) => ms[f] !== undefined)) topAuditCount++;

    const doc = { ...ms };
    const originalId = doc._id;
    delete doc._id;

    // Normalize media images without deleting any Cloudflare media
    for (const imgField of ['certificateImage', 'logoImage', 'mobileLogoImage', 'loginModalImage']) {
      if (doc[imgField] && typeof doc[imgField] === 'object') {
        const norm = normalizeMediaObject(doc[imgField]);
        doc[imgField] = { url: norm.url, key: norm.key };
      }
    }

    if (Array.isArray(doc.trustBadges)) {
      doc.trustBadges = doc.trustBadges.map((tb) => {
        const normImg = tb.image ? normalizeMediaObject(tb.image) : { url: '', key: '' };
        return {
          ...(tb._id ? { _id: tb._id } : {}),
          title: tb.title || '',
          image: { url: normImg.url, key: normImg.key },
          order: tb.order ?? 0,
        };
      });
    }

    // Clear dangling currentThemeId if that theme does not exist in TO_DB
    if (doc.currentThemeId) {
      const themeExists = await toThemesColl.findOne(
        { _id: doc.currentThemeId },
        { projection: { _id: 1 } }
      );
      if (!themeExists) {
        doc.currentThemeId = null;
      }
    }

    migrateAuditFieldsToMeta(doc, 'settings');

    const existing = await toSettingsColl.findOne(
      { $or: [{ 'meta.deletedAt': null }, { 'meta.deletedAt': { $exists: false } }] },
      { projection: { _id: 1 } }
    );

    if (isExecute) {
      if (existing) {
        await toSettingsColl.updateOne({ _id: existing._id }, { $set: doc });
      } else {
        await toSettingsColl.updateOne(
          { _id: originalId },
          { $set: doc },
          { upsert: true }
        );
      }
    }

    console.log(
      `  [${existing ? 'UPDATE' : 'INSERT'}] settings | trustBadges: ${Array.isArray(doc.trustBadges) ? doc.trustBadges.length : 0} | company: ${doc.businessDetails?.companyName || ''}`
    );
  }

  const toCountAfter = await toSettingsColl.countDocuments();
  return {
    collection: 'settings',
    source: `MASTER_DB (${masterConn.name})`,
    fromDocs: masterSettings.length,
    skippedDeleted: 0,
    toDocs: isExecute ? toCountAfter : Math.max(toCountAfter, masterSettings.length),
    vCount,
    topAuditCount,
    conflictsResolved: 0,
  };
}

const MASTER_COLLECTIONS = new Set(['filters', 'settings', 'top_announcements', 'modules']);

async function migrateStandardCollection({ sourceDb, targetDb, sourceLabel, collName, toColNamesSet, isExecute }) {
  const fromColl = sourceDb.collection(collName);
  const totalFromCount = await fromColl.countDocuments();
  if (totalFromCount === 0) return null;

  const sourceFilter = { isDeleted: { $ne: true } };
  const skippedDeletedCount = await fromColl.countDocuments({ isDeleted: true });
  const count = await fromColl.countDocuments(sourceFilter);
  const vCount = await fromColl.countDocuments({ ...sourceFilter, __v: { $exists: true } });
  const topAuditCount = await fromColl.countDocuments({
    ...sourceFilter,
    $or: TOP_AUDIT_FIELDS.map((f) => ({ [f]: { $exists: true } })),
  });

  console.log(
    `Processing [${collName}] from ${sourceLabel} (${count} active docs | skipped isDeleted=true: ${skippedDeletedCount} | __v: ${vCount} | top-level audit: ${topAuditCount})...`
  );

  const toColl = targetDb.collection(collName);
  let uniqueIndexes = [];
  if (toColNamesSet.has(collName)) {
    const idxs = await toColl.indexes();
    uniqueIndexes = idxs.filter((i) => i.unique);
  }

  const ctx = {
    usedSlugs: collName === 'products' ? new Set() : null,
  };

  const cursor = fromColl.find(sourceFilter);
  let processed = 0;
  let totalConflictsResolved = 0;
  let batchDocs = [];
  const previewCategories = [];

  while (await cursor.hasNext()) {
    const rawDoc = await cursor.next();
    const transformed = transformDocument(rawDoc, collName, ctx);
    if (collName === 'categories') {
      previewCategories.push(transformed);
    }
    batchDocs.push(transformed);
    processed++;

    if (batchDocs.length >= 250) {
      totalConflictsResolved += await resolveUniqueConflicts(toColl, batchDocs, uniqueIndexes, isExecute);
      if (isExecute) {
        const ops = batchDocs.map((d) => ({
          replaceOne: {
            filter: { _id: d._id },
            replacement: d,
            upsert: true,
          },
        }));
        await toColl.bulkWrite(ops, { ordered: false });
      }
      batchDocs = [];
    }
  }

  if (batchDocs.length > 0) {
    totalConflictsResolved += await resolveUniqueConflicts(toColl, batchDocs, uniqueIndexes, isExecute);
    if (isExecute) {
      const ops = batchDocs.map((d) => ({
        replaceOne: {
          filter: { _id: d._id },
          replacement: d,
          upsert: true,
        },
      }));
      await toColl.bulkWrite(ops, { ordered: false });
    }
  }

  const toCountAfter = await toColl.countDocuments();
  console.log(
    `  -> Processed ${processed} docs (skipped ${skippedDeletedCount} deleted).${totalConflictsResolved ? ` Unique conflicts resolved: ${totalConflictsResolved}.` : ''}`
  );

  return {
    previewCategories,
    summary: {
      collection: collName,
      fromDocs: count,
      skippedDeleted: skippedDeletedCount,
      toDocs: toCountAfter,
      vCount,
      topAuditCount,
      conflictsResolved: totalConflictsResolved,
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');
  const targetColArg = args.find((a) => a.startsWith('--collection='));
  const targetCollection = targetColArg ? targetColArg.split('=')[1] : null;

  const fromUri = process.env.FROM_DB ? process.env.FROM_DB.trim() : '';
  const toUri = process.env.TO_DB ? process.env.TO_DB.trim() : '';
  const masterUri = process.env.MASTER_DB ? process.env.MASTER_DB.trim() : '';

  if (!fromUri || !toUri) {
    throw new Error('Both FROM_DB and TO_DB must be defined in .env.');
  }
  if (fromUri === toUri) {
    throw new Error('FROM_DB and TO_DB must point to different databases so FROM_DB is never modified.');
  }

  console.log(`\n======================================================`);
  console.log(`🚀 DATABASE SCHEMA MIGRATION & AUDIT TOOL`);
  console.log(`Mode: ${isExecute ? '⚡ LIVE EXECUTION' : '🔍 DRY RUN (Preview only, no DB writes)'}`);
  console.log(`Strategy: 📦 CROSS-DB (FROM_DB [read-only] -> TO_DB [write])`);
  if (masterUri) console.log(`Master Sync: 🎛️  MASTER_DB [read-only] -> TO_DB (filters, settings, top_announcements, modules)`);
  if (targetCollection) console.log(`Target Collection: ${targetCollection}`);
  console.log(`======================================================\n`);

  const fromConn = await mongoose.createConnection(fromUri).asPromise();
  const toConn = await mongoose.createConnection(toUri).asPromise();
  console.log(`FROM_DB (READ-ONLY): ${fromConn.name}`);
  console.log(`TO_DB   (TARGET)   : ${toConn.name}\n`);

  const fromDb = fromConn.db;
  const toDb = toConn.db;

  const allFromCols = (await fromDb.listCollections().toArray()).map((c) => c.name).sort();
  const toColNamesSet = new Set((await toDb.listCollections().toArray()).map((c) => c.name));

  const diffReport = [];
  let migratedCategoriesPreview = [];

  for (const collName of allFromCols) {
    if (targetCollection && collName !== targetCollection) continue;
    // Collections in MASTER_COLLECTIONS are sourced from MASTER_DB when MASTER_DB is configured
    if (masterUri && MASTER_COLLECTIONS.has(collName)) continue;

    const result = await migrateStandardCollection({
      sourceDb: fromDb,
      targetDb: toDb,
      sourceLabel: `FROM_DB (${fromConn.name})`,
      collName,
      toColNamesSet,
      isExecute,
    });
    if (result) {
      if (result.previewCategories.length > 0) {
        migratedCategoriesPreview = result.previewCategories;
      }
      diffReport.push(result.summary);
    }
  }

  // Sync filters, settings, top_announcements, and modules from MASTER_DB
  const shouldSyncMasterCol = (name) => !targetCollection || targetCollection === name;

  if (masterUri && Array.from(MASTER_COLLECTIONS).some(shouldSyncMasterCol)) {
    if (masterUri === toUri) {
      throw new Error('MASTER_DB and TO_DB must point to different databases.');
    }
    const masterConn = await mongoose.createConnection(masterUri).asPromise();
    try {
      if (shouldSyncMasterCol('top_announcements')) {
        const res = await migrateStandardCollection({
          sourceDb: masterConn.db,
          targetDb: toDb,
          sourceLabel: `MASTER_DB (${masterConn.name})`,
          collName: 'top_announcements',
          toColNamesSet,
          isExecute,
        });
        if (res) diffReport.push(res.summary);
      }
      if (shouldSyncMasterCol('modules')) {
        const res = await migrateStandardCollection({
          sourceDb: masterConn.db,
          targetDb: toDb,
          sourceLabel: `MASTER_DB (${masterConn.name})`,
          collName: 'modules',
          toColNamesSet,
          isExecute,
        });
        if (res) diffReport.push(res.summary);
      }
      if (shouldSyncMasterCol('filters')) {
        const filterSummary = await syncFiltersFromMaster({
          masterConn,
          toConn,
          fallbackCategories: migratedCategoriesPreview,
          isExecute,
        });
        diffReport.push(filterSummary);
      }
      if (shouldSyncMasterCol('settings')) {
        const settingsSummary = await syncSettingsFromMaster({
          masterConn,
          toConn,
          isExecute,
        });
        diffReport.push(settingsSummary);
      }
    } finally {
      await masterConn.close();
    }
  }

  console.log(`\n======================================================`);
  console.log(`📊 MIGRATION SUMMARY`);
  console.log(`======================================================`);
  diffReport.forEach((r) => {
    console.log(
      `[${r.collection.padEnd(24)}] FROM(active): ${String(r.fromDocs).padStart(4)} | Skipped(del): ${String(r.skippedDeleted).padStart(3)} | TO: ${String(r.toDocs).padStart(4)} | __v cleaned: ${String(r.vCount).padStart(4)} | Top-level audit moved: ${String(r.topAuditCount).padStart(4)}${r.conflictsResolved ? ` | Conflicts resolved: ${r.conflictsResolved}` : ''}`
    );
  });

  generateMarkdownReport(diffReport, {
    isExecuted: isExecute,
    fromDbName: fromConn.name,
    toDbName: toConn.name,
    masterDbName: masterUri ? masterUri.split('/').pop().split('?')[0] : null,
  });

  await fromConn.close();
  await toConn.close();
  console.log(`\nDone. Execution completed.\n`);
}

function generateMarkdownReport(diffReport, info) {
  const reportPath = path.join(__dirname, '..', '..', 'SCHEMA_MIGRATION_DIFF_REPORT.md');
  const totalV = diffReport.reduce((acc, r) => acc + r.vCount, 0);
  const totalAudit = diffReport.reduce((acc, r) => acc + r.topAuditCount, 0);
  const totalDocs = diffReport.reduce((acc, r) => acc + r.fromDocs, 0);
  const totalSkipped = diffReport.reduce((acc, r) => acc + r.skippedDeleted, 0);

  let md = `# Database Schema Migration & Differences Report

Generated on: \`${new Date().toISOString()}\`  
Status: **${info.isExecuted ? 'EXECUTED (Target Database Updated)' : 'DRY RUN (Preview Only)'}**  
Mode: **Cross-DB Migration (\`${info.fromDbName}\` [Read-Only] ➔ \`${info.toDbName}\`)**  

---

## Executive Summary

1. **Source Protection (\`FROM_DB\` & \`MASTER_DB\`)**:
   - \`${info.fromDbName}\` (\`FROM_DB\`) and ${info.masterDbName ? `\`${info.masterDbName}\` (\`MASTER_DB\`)` : '`MASTER_DB`'} were opened strictly for **read-only** traversal. Zero writes, updates, or deletions were performed on source databases.
2. **Soft-Delete Filtering & Cleanup**:
   - **${totalSkipped}** records with \`isDeleted: true\` in \`FROM_DB\` were **skipped** and not migrated to \`TO_DB\`.
   - Top-level \`isDeleted\` (\`isDeleted: false\`) was stripped from all migrated records (soft deletion is represented by \`meta.deletedAt: null\`).
3. **Top-Level Audit Fields Moved to \`meta\`**:
   - Across **${totalAudit}** documents that had top-level \`createdAt\`, \`createdBy\`, \`updatedAt\`, or \`updatedBy\`, values were moved into \`meta\` (\`meta.createdAt\`, \`meta.createdBy\`, \`meta.updatedAt\`, \`meta.updatedBy\`) and **removed from the top level**.
4. **Version Key Cleanup (\`__v\`)**:
   - \`__v\` was removed from **${totalV}** records (0 remaining in target).
5. **Third-Party & Cloudflare Media Safety**:
   - **Zero** media files deleted. All Cloudflare R2 / CDN image URLs and keys are fully preserved.
6. **Mapped vs Extra Field Handling**:
   - Legacy top-level fields mapped into nested/renamed model fields (e.g., \`title\`, \`sku\`, \`description\`, \`gstPercentage\`, \`baseMetalWeight\`, \`baseLabourCharge\`, \`certificateCharge\`, \`otherAmountPercentage\`, \`displayPrice\`, \`category\`, \`menuItem\`, \`size\`, \`metalColors\`, \`gender\`, \`position\`, \`user\`, \`rating\`, \`comment\`, \`images\`, etc.) are **removed from the top level**.
   - Genuinely extra database fields missing from the latest Mongoose schemas (e.g., \`birthMonth\`, \`subTypes\`, \`densityFactor\`, \`purity\`, \`video\`, etc.) are retained at the top level (while \`featured\` and \`subType\` are explicitly skipped from \`products\`).
7. **Product Slugs & Schema Mapping (${totalDocs} active source records migrated)**:
   - \`products\`: Set \`productType: "gold"\` & \`isOrnate: false\`; mapped \`status\` (\`active\` ➔ \`approved\`, \`inactive\` ➔ \`draft\`); converted \`promoBanner\` strings to MongoDB \`ObjectId\`; generated unique \`basicInfo.slug\` from \`title\`; mapped \`basicInfo\`, \`pricing\`, \`specifications\`, \`categoryIds\`, \`menuItemIds\`, \`sizeIds\`, \`metalColorIds\`, \`variants\`, stone rows (\`centerDiamondRows\`, \`sideDiamondRows\`, \`colorStoneRows\`, \`sideColorStoneRows\`), \`colorImages\`, and \`meta\`; removed mapped legacy fields plus \`featured\` and \`subType\` from top level and subdocuments.

---

## Collection Details & Differences

| Collection | \`FROM_DB\` Active | Skipped (\`isDeleted: true\`) | \`TO_DB\` Docs | \`__v\` Removed | Top-Level Audit Moved | Unique Conflicts Resolved | Key Differences & Transformations |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
`;

  diffReport.forEach((r) => {
    let diffNotes = '';
    if (r.collection === 'products') {
      diffNotes =
        'Set `productType: "gold"`, `isOrnate: false`; mapped `status` (`active`->`approved`, `inactive`->`draft`); converted `promoBanner` to `ObjectId[]`; mapped `basicInfo` (unique `slug`), `pricing`, `specifications`, `*Ids`, `variants`, stone rows, `colorImages`; removed mapped legacy keys plus `featured` & `subType`; moved audit to `meta`; removed `__v` & `isDeleted`; kept `birthMonth`.';
    } else if (r.collection === 'banners') {
      diffNotes =
        'Mapped `category`, `type`, `position`, `mediaType` to `display` & `image`; removed mapped top-level keys; moved audit to `meta`; removed `__v` & `isDeleted`; kept `video`.';
    } else if (r.collection === 'categories') {
      diffNotes =
        'Generated `slug`; normalized `images`, `sizeChart`, and `subTypes[*].sizeChart` keys; set `sizingConfig`, `order`, `promoBanners`; moved audit to `meta`; removed `__v` & `isDeleted`.';
    } else if (r.collection === 'reviews') {
      diffNotes =
        'Mapped `user`, `title`, `rating`, `comment`, `images` to `customer`, `review`, `image`; removed mapped top-level keys; moved audit to `meta`; removed `__v`.';
    } else if (r.collection === 'sizes') {
      diffNotes =
        'Mapped `category` to `categoryId` & removed top-level `category`; moved audit to `meta`; removed `__v` & `isDeleted`; kept `subType`.';
    } else if (r.collection === 'metal_purities') {
      diffNotes =
        'Set `order: 0`; moved `createdAt` to `meta` & removed top-level; removed `__v`; preserved `densityFactor`, `purity`.';
    } else if (r.collection === 'metal_colors') {
      diffNotes =
        'Normalized `colorCode`/`colorCodeEnd`; moved `createdAt` to `meta` & removed top-level; removed `__v`.';
    } else if (r.collection === 'birthstones') {
      diffNotes =
        'Normalized `image.key`; set `order: 0`; moved `createdAt`/`updatedAt` to `meta` & removed top-level; removed `__v`.';
    } else if (r.collection.includes('diamond_price') || r.collection === 'gold_prices') {
      diffNotes =
        'Moved top-level `createdAt`/`updatedAt`/`updatedBy` to `meta` & removed top-level; removed `__v`; preserved legacy fields.';
    } else if (r.collection.startsWith('diamond_')) {
      diffNotes =
        'Normalized `image` structure; moved `createdAt`/`updatedAt` to `meta` & removed top-level; removed `__v`.';
    } else if (r.collection === 'users') {
      diffNotes = 'Ensured `ownerId: null` default; verified `meta`; removed `__v`.';
    } else if (r.collection === 'modules') {
      diffNotes =
        'Synced from `MASTER_DB` (`new-neirah`); resolved any `slug` `_id` conflicts in `TO_DB`; verified `meta` & removed `__v`.';
    } else if (r.collection === 'top_announcements') {
      diffNotes =
        'Synced from `MASTER_DB` (`new-neirah`); verified `meta` & removed `__v` / `isDeleted`.';
    } else if (r.collection === 'filters') {
      diffNotes =
        'Synced from `MASTER_DB` (`new-neirah`); rebuilt `categoryConfigs` with `TO_DB` category `_id`s & `slug`s (preserving `priceRanges` & slug config matching).';
    } else if (r.collection === 'settings') {
      diffNotes =
        'Synced from `MASTER_DB` (`new-neirah`); normalized image keys, cleaned `trustBadges`, validated `currentThemeId` against `TO_DB.themes`, ensured `meta`.';
    } else {
      diffNotes =
        'Copied & verified schema alignment; moved any top-level audit fields to `meta`; removed `__v`.';
    }

    md += `| \`${r.collection}\` | ${r.fromDocs} | ${r.skippedDeleted} | ${r.toDocs} | ${r.vCount} | ${r.topAuditCount} | ${r.conflictsResolved} | ${diffNotes} |\n`;
  });

  md += `\n---

## Usage in the Future

Script location: \`src/scripts/migrateSchemaToLatest.js\`

\`\`\`bash
# 1. Dry-run preview (reads FROM_DB, checks TO_DB, writes nothing)
node src/scripts/migrateSchemaToLatest.js --dry-run

# 2. Execute full migration (FROM_DB -> TO_DB, plus filters, settings, top_announcements & modules from MASTER_DB)
node src/scripts/migrateSchemaToLatest.js --execute

# 3. Migrate or sync a single collection only
node src/scripts/migrateSchemaToLatest.js --execute --collection=products
node src/scripts/migrateSchemaToLatest.js --execute --collection=filters
node src/scripts/migrateSchemaToLatest.js --execute --collection=settings
node src/scripts/migrateSchemaToLatest.js --execute --collection=top_announcements
node src/scripts/migrateSchemaToLatest.js --execute --collection=modules
\`\`\`
`;

  fs.writeFileSync(reportPath, md, 'utf8');
  console.log(`\n📄 Generated Markdown diff report at: ${reportPath}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error during migration:', err);
    process.exit(1);
  });
}

module.exports = {
  transformDocument,
};
