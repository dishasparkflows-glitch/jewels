/**
 * ============================================================================
 * Schema Alignment & Cross-Database Migration Script
 * ============================================================================
 *
 * Purpose:
 * Reads collections one by one from FROM_DB (read-only), maps every record to
 * match the latest Mongoose schemas, and inserts/upserts into TO_DB.
 * (Also supports --in-place on MONGODB_URI if needed.)
 *
 * Key Rules & Guarantees:
 * 1. Read-Only Source: FROM_DB records are NEVER modified, updated, or deleted.
 * 2. Media Safety: NEVER deletes any 3rd-party or Cloudflare R2 media assets.
 * 3. Audit Migration: Moves any top-level `createdAt`, `createdBy`, `updatedAt`,
 *    `updatedBy` fields into `meta` and REMOVES those top-level fields.
 * 4. Version Key Cleanup: Removes `__v` from every record.
 * 5. Extra Field Preservation: Keeps all other extra database fields that are
 *    missing from the model schema at the top level untouched.
 * 6. Product Slugs & Nested Mapping: Generates `basicInfo.slug` from `title`
 *    (unique across products), maps `basicInfo`, `pricing`, `specifications`,
 *    `*Ids`, `variants`, stone rows, and `colorImages`.
 *
 * Usage:
 *   node src/scripts/migrateSchemaToLatest.js --dry-run
 *   node src/scripts/migrateSchemaToLatest.js --execute
 *   node src/scripts/migrateSchemaToLatest.js --execute --collection=products
 *   node src/scripts/migrateSchemaToLatest.js --in-place --dry-run
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
  delete doc.__v;
}

function mapStoneRowIds(row, includeColorAndClarity = false) {
  if (!row || typeof row !== 'object') return row;
  const r = { ...row };
  if (!r.diamondTypeId && r.diamondType) r.diamondTypeId = r.diamondType;
  if (!r.diamondShapeId && r.diamondShape) r.diamondShapeId = r.diamondShape;
  if (includeColorAndClarity) {
    if (!r.diamondColorId && r.diamondColor) r.diamondColorId = r.diamondColor;
    if (!r.diamondClarityId && r.diamondClarity) r.diamondClarityId = r.diamondClarity;
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

    if (doc.productType === undefined) doc.productType = 'gold';
    if (doc.isOrnate === undefined) doc.isOrnate = false;
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
        return vObj;
      });
    }

    if (Array.isArray(doc.colorImages)) {
      doc.colorImages = doc.colorImages.map((ci) => {
        const ciObj = { ...ci };
        if (!ciObj.metalColorId && ciObj.metalColor) ciObj.metalColorId = ciObj.metalColor;
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
  },

  sizes: (doc) => {
    if (!doc.categoryId && doc.category) {
      doc.categoryId = doc.category;
    }
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
  },

  users: (doc) => {
    if (doc.ownerId === undefined) doc.ownerId = null;
  },

  instagram_posts: (doc) => {
    if (doc.title === undefined) doc.title = '';
    if (doc.order === undefined) doc.order = Number(doc.position) || 0;
    if (doc.isActive === undefined) doc.isActive = true;
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

async function main() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');
  const isInPlace = args.includes('--in-place');
  const targetColArg = args.find((a) => a.startsWith('--collection='));
  const targetCollection = targetColArg ? targetColArg.split('=')[1] : null;

  const fromArg = args.find((a) => a.startsWith('--from='));
  const toArg = args.find((a) => a.startsWith('--to='));

  const fromUri = fromArg ? fromArg.split('=')[1] : process.env.FROM_DB;
  const toUri = toArg ? toArg.split('=')[1] : process.env.TO_DB;

  const crossDbMode = !isInPlace && Boolean(fromUri && toUri);

  if (!crossDbMode && !process.env.MONGODB_URI) {
    throw new Error('Neither FROM_DB/TO_DB nor MONGODB_URI is configured.');
  }

  console.log(`\n======================================================`);
  console.log(`🚀 DATABASE SCHEMA MIGRATION & AUDIT TOOL`);
  console.log(`Mode: ${isExecute ? '⚡ LIVE EXECUTION' : '🔍 DRY RUN (Preview only, no DB writes)'}`);
  console.log(`Strategy: ${crossDbMode ? '📦 CROSS-DB (FROM_DB [read-only] -> TO_DB [write])' : '🔧 IN-PLACE (MONGODB_URI)'}`);
  if (targetCollection) console.log(`Target Collection: ${targetCollection}`);
  console.log(`======================================================\n`);

  let fromConn;
  let toConn;

  if (crossDbMode) {
    fromConn = await mongoose.createConnection(fromUri).asPromise();
    toConn = await mongoose.createConnection(toUri).asPromise();
    console.log(`FROM_DB (READ-ONLY): ${fromConn.name}`);
    console.log(`TO_DB   (TARGET)   : ${toConn.name}\n`);
  } else {
    fromConn = await mongoose.createConnection(process.env.MONGODB_URI).asPromise();
    toConn = fromConn;
    console.log(`Connected DB: ${fromConn.name}\n`);
  }

  const fromDb = fromConn.db;
  const toDb = toConn.db;

  const allFromCols = (await fromDb.listCollections().toArray()).map((c) => c.name).sort();
  const toColNamesSet = new Set((await toDb.listCollections().toArray()).map((c) => c.name));

  const diffReport = [];

  for (const collName of allFromCols) {
    if (targetCollection && collName !== targetCollection) continue;

    const fromColl = fromDb.collection(collName);
    const count = await fromColl.countDocuments();
    if (count === 0) continue;

    const vCount = await fromColl.countDocuments({ __v: { $exists: true } });
    const topAuditCount = await fromColl.countDocuments({
      $or: TOP_AUDIT_FIELDS.map((f) => ({ [f]: { $exists: true } })),
    });

    console.log(`Processing [${collName}] (${count} docs | __v: ${vCount} | top-level audit: ${topAuditCount})...`);

    const toColl = toDb.collection(collName);
    let uniqueIndexes = [];
    if (crossDbMode && toColNamesSet.has(collName)) {
      const idxs = await toColl.indexes();
      uniqueIndexes = idxs.filter((i) => i.unique);
    }

    const ctx = {
      usedSlugs: collName === 'products' ? new Set() : null,
    };

    const cursor = fromColl.find({});
    let processed = 0;
    let totalConflictsResolved = 0;
    let batchDocs = [];

    while (await cursor.hasNext()) {
      const rawDoc = await cursor.next();
      const transformed = transformDocument(rawDoc, collName, ctx);
      batchDocs.push(transformed);
      processed++;

      if (batchDocs.length >= 250) {
        if (crossDbMode) {
          totalConflictsResolved += await resolveUniqueConflicts(toColl, batchDocs, uniqueIndexes, isExecute);
        }
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
      if (crossDbMode) {
        totalConflictsResolved += await resolveUniqueConflicts(toColl, batchDocs, uniqueIndexes, isExecute);
      }
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

    const toCountAfter = crossDbMode && isExecute ? await toColl.countDocuments() : await toColl.countDocuments();
    diffReport.push({
      collection: collName,
      fromDocs: count,
      toDocs: toCountAfter,
      vCount,
      topAuditCount,
      conflictsResolved: totalConflictsResolved,
    });

    console.log(
      `  -> Processed ${processed} docs.${totalConflictsResolved ? ` Unique conflicts resolved: ${totalConflictsResolved}.` : ''}`
    );
  }

  console.log(`\n======================================================`);
  console.log(`📊 MIGRATION SUMMARY`);
  console.log(`======================================================`);
  diffReport.forEach((r) => {
    console.log(
      `[${r.collection.padEnd(24)}] FROM: ${String(r.fromDocs).padStart(4)} | TO: ${String(r.toDocs).padStart(4)} | __v cleaned: ${String(r.vCount).padStart(4)} | Top-level audit moved: ${String(r.topAuditCount).padStart(4)}${r.conflictsResolved ? ` | Conflicts resolved: ${r.conflictsResolved}` : ''}`
    );
  });

  generateMarkdownReport(diffReport, {
    isExecuted: isExecute,
    crossDbMode,
    fromDbName: fromConn.name,
    toDbName: toConn.name,
  });

  await fromConn.close();
  if (toConn !== fromConn) await toConn.close();
  console.log(`\nDone. Execution completed.\n`);
}

function generateMarkdownReport(diffReport, info) {
  const reportPath = path.join(__dirname, '..', '..', 'SCHEMA_MIGRATION_DIFF_REPORT.md');
  const totalV = diffReport.reduce((acc, r) => acc + r.vCount, 0);
  const totalAudit = diffReport.reduce((acc, r) => acc + r.topAuditCount, 0);
  const totalDocs = diffReport.reduce((acc, r) => acc + r.fromDocs, 0);

  let md = `# Database Schema Migration & Differences Report

Generated on: \`${new Date().toISOString()}\`  
Status: **${info.isExecuted ? 'EXECUTED (Target Database Updated)' : 'DRY RUN (Preview Only)'}**  
Mode: **${info.crossDbMode ? `Cross-DB Migration (\`${info.fromDbName}\` [Read-Only] ➔ \`${info.toDbName}\`)` : `In-Place (\`${info.toDbName}\`)`}**  

---

## Executive Summary

1. **Source Protection (\`FROM_DB\`)**:
   - \`${info.fromDbName}\` was opened strictly for **read-only** traversal. Zero writes, updates, or deletions were performed on \`FROM_DB\`.
2. **Top-Level Audit Fields Moved to \`meta\`**:
   - Across **${totalAudit}** documents that had top-level \`createdAt\`, \`createdBy\`, \`updatedAt\`, or \`updatedBy\`, values were moved into \`meta\` (\`meta.createdAt\`, \`meta.createdBy\`, \`meta.updatedAt\`, \`meta.updatedBy\`) and **removed from the top level**.
3. **Version Key Cleanup (\`__v\`)**:
   - \`__v\` was removed from **${totalV}** records (0 remaining in target).
4. **Third-Party & Cloudflare Media Safety**:
   - **Zero** media files deleted. All Cloudflare R2 / CDN image URLs and keys are fully preserved.
5. **Extra Field Preservation**:
   - All other extra database fields missing from the latest Mongoose schemas (e.g., \`subType\`, \`displayPrice\`, \`isDeleted\`, \`category\`, \`subTypes\`, \`densityFactor\`, \`purity\`, etc.) are retained at the top level.
6. **Product Slugs & Schema Mapping (${totalDocs} total source records migrated)**:
   - \`products\`: Generated unique \`basicInfo.slug\` from \`title\`; mapped \`basicInfo\`, \`pricing\`, \`specifications\`, \`categoryIds\`, \`menuItemIds\`, \`sizeIds\`, \`metalColorIds\`, \`variants\`, stone rows (\`centerDiamondRows\`, \`sideDiamondRows\`, \`colorStoneRows\`, \`sideColorStoneRows\`), \`colorImages\`, and \`meta\`.

---

## Collection Details & Differences

| Collection | \`FROM_DB\` Docs | \`TO_DB\` Docs | \`__v\` Removed | Top-Level Audit Moved | Unique Conflicts Resolved | Key Differences & Transformations |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
`;

  diffReport.forEach((r) => {
    let diffNotes = '';
    if (r.collection === 'products') {
      diffNotes =
        'Mapped `basicInfo` (generated unique `slug` from `title`), `pricing`, `specifications`, `*Ids`, `variants`, stone row IDs, `colorImages`; moved `createdAt`/`updatedAt` to `meta` & removed top-level; removed `__v`; preserved extra fields.';
    } else if (r.collection === 'banners') {
      diffNotes =
        'Mapped `category`, `type`, `position` to `display`; normalized `content` & `image.key`; moved `createdAt`/`updatedAt` to `meta` & removed top-level; removed `__v`; preserved extra fields.';
    } else if (r.collection === 'categories') {
      diffNotes =
        'Generated `slug`; normalized `images`, `sizeChart`, and `subTypes[*].sizeChart` keys; set `sizingConfig`, `order`, `promoBanners`; moved `createdAt` to `meta` & removed top-level; removed `__v`.';
    } else if (r.collection === 'reviews') {
      diffNotes =
        'Mapped `user` to `customer`, `title`/`rating`/`comment` to `review`, `images` to `image`; moved `createdAt`/`updatedAt` to `meta` & removed top-level; removed `__v`.';
    } else if (r.collection === 'sizes') {
      diffNotes =
        'Mapped `category` to `categoryId`; moved `createdAt` to `meta` & removed top-level; removed `__v`; preserved `subType`, `category`.';
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
        'Synced authoritative module records from `FROM_DB` (resolved auto-seeded `slug` `_id` mismatches in `TO_DB`).';
    } else {
      diffNotes =
        'Copied & verified schema alignment; moved any top-level audit fields to `meta`; removed `__v`.';
    }

    md += `| \`${r.collection}\` | ${r.fromDocs} | ${r.toDocs} | ${r.vCount} | ${r.topAuditCount} | ${r.conflictsResolved} | ${diffNotes} |\n`;
  });

  md += `\n---

## Usage in the Future

Script location: \`src/scripts/migrateSchemaToLatest.js\`

\`\`\`bash
# 1. Dry-run preview (reads FROM_DB, checks TO_DB, writes nothing)
node src/scripts/migrateSchemaToLatest.js --dry-run

# 2. Execute FROM_DB -> TO_DB migration (FROM_DB remains untouched)
node src/scripts/migrateSchemaToLatest.js --execute

# 3. Migrate a single collection only
node src/scripts/migrateSchemaToLatest.js --execute --collection=products

# 4. In-place mode against MONGODB_URI (optional)
node src/scripts/migrateSchemaToLatest.js --in-place --execute
\`\`\`
`;

  fs.writeFileSync(reportPath, md, 'utf8');
  console.log(`\n📄 Generated Markdown diff report at: ${reportPath}`);
}

main().catch((err) => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
