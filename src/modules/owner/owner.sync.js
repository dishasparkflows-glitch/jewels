const mongoose = require('mongoose');
const { decryptDatabaseUrl } = require('../../utils/encryption');

const Category = require('../category/category.model');
const Filter = require('../filter/filter.model');
const MenuSection = require('../menuSection/menuSection.model');
const MenuItem = require('../menuItem/menuItem.model');
const MetalColor = require('../metalColor/metalColor.model');
const MetalPurity = require('../metalPurity/metalPurity.model');
const Size = require('../size/size.model');
const VtoMaster = require('../vtoMaster/vtoMaster.model');
const Birthstone = require('../birthstone/birthstone.model');
const DiamondType = require('../diamondType/diamondType.model');
const DiamondShape = require('../diamondShape/diamondShape.model');
const DiamondColor = require('../diamondColor/diamondColor.model');
const DiamondClarity = require('../diamondClarity/diamondClarity.model');
const DiamondSize = require('../diamondSize/diamondSize.model');
const GemstoneType = require('../gemstoneType/gemstoneType.model');
const GemstoneShape = require('../gemstoneShape/gemstoneShape.model');
const GoldPrice = require('../goldPrice/goldPrice.model');
const DiamondPrice = require('../diamondPrice/diamondPrice.model');
const CenterDiamondPrice = require('../centerDiamondPrice/centerDiamondPrice.model');
const SideDiamondPrice = require('../sideDiamondPrice/sideDiamondPrice.model');
const Currency = require('../currency/currency.model');
const CodSequence = require('../codSequence/codSequence.model');

const REFERENCE_MODELS = [
  Category,
  Filter,
  MenuSection,
  MenuItem,
  MetalColor,
  MetalPurity,
  Size,
  VtoMaster,
  Birthstone,
  DiamondType,
  DiamondShape,
  DiamondColor,
  DiamondClarity,
  DiamondSize,
  GemstoneType,
  GemstoneShape,
  GoldPrice,
  DiamondPrice,
  CenterDiamondPrice,
  SideDiamondPrice,
  Currency,
  CodSequence,
];

const IMAGE_FIELD_NAMES = new Set([
  'image',
  'images',
  'icon',
  'iconSvg',
  'swatchImage',
  'lightImage',
  'darkImage',
  'mobileImage',
  'bannerImage',
  'thumbnail',
  'photo',
  'avatar',
  'logo',
  'logoImage',
  'mobileLogoImage',
  'certificateImage',
  'loginModalImage',
  'beforeImage',
  'afterImage',
  'referenceImages',
  'vtoImage',
  'variantIcon',
]);

/**
 * Recursively strips image/media fields from a plain document before syncing
 * to an owner's database.
 */
function stripImageFields(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((entry) => stripImageFields(entry));
  }
  if (value instanceof Date || value instanceof mongoose.Types.ObjectId || Buffer.isBuffer(value)) {
    return value;
  }
  if (typeof value !== 'object') return value;

  const cleaned = {};
  for (const [key, val] of Object.entries(value)) {
    if (IMAGE_FIELD_NAMES.has(key)) {
      continue;
    }
    cleaned[key] = stripImageFields(val);
  }
  return cleaned;
}

const ACTIVE_FILTER = {
  $or: [{ 'meta.deletedAt': null }, { 'meta.deletedAt': { $exists: false } }],
};

function formatCollectionLabel(colName = '') {
  return String(colName)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function summarizeDoc(doc = {}) {
  const primary =
    doc.name ||
    doc.title ||
    doc.label ||
    doc.displayName ||
    doc.code ||
    doc.currencyCode ||
    doc.prefix ||
    doc.carat ||
    doc.shape ||
    doc.color ||
    doc.clarity ||
    doc.slug ||
    String(doc._id || '');

  const secondary =
    doc.slug ||
    doc.code ||
    doc.type ||
    doc.group ||
    doc.status ||
    '';

  return {
    _id: doc._id,
    primary: String(primary),
    secondary: secondary && String(secondary) !== String(primary) ? String(secondary) : '',
    status: doc.status || (doc.isActive === false ? 'inactive' : 'active'),
  };
}

/**
 * Loads categories & master table counts and preview records from the central DB,
 * along with existing record counts in the owner's target database.
 */
async function getOwnerSeedPreview(owner) {
  const databaseUrl = decryptDatabaseUrl(owner?.databaseUrl);
  let ownerConn = null;

  try {
    if (databaseUrl && /^mongodb(\+srv)?:\/\//i.test(databaseUrl)) {
      ownerConn = await mongoose
        .createConnection(databaseUrl, {
          serverSelectionTimeoutMS: 8000,
          connectTimeoutMS: 8000,
        })
        .asPromise()
        .catch(() => null);
    }

    const tables = await Promise.all(
      REFERENCE_MODELS.map(async (Model) => {
        const colName = Model.collection.collectionName;
        const [centralCount, sampleDocs, targetCount] = await Promise.all([
          Model.countDocuments(ACTIVE_FILTER),
          Model.find(ACTIVE_FILTER).limit(100).lean(),
          ownerConn
            ? ownerConn.db.collection(colName).countDocuments(ACTIVE_FILTER).catch(() => null)
            : Promise.resolve(null),
        ]);

        return {
          collection: colName,
          label: formatCollectionLabel(colName),
          centralCount,
          targetCount,
          items: sampleDocs.map(summarizeDoc),
        };
      })
    );

    const totalCentralRecords = tables.reduce((sum, t) => sum + (t.centralCount || 0), 0);
    const totalTargetRecords = tables.reduce((sum, t) => sum + (t.targetCount || 0), 0);

    return {
      tables,
      totalCentralRecords,
      totalTargetRecords,
      ownerConnected: Boolean(ownerConn),
    };
  } finally {
    if (ownerConn) {
      await ownerConn.close().catch(() => {});
    }
  }
}

/**
 * Syncs categories and all (or selected) master tables from the central database into an
 * owner's target database (`owner.databaseUrl`), excluding all image field values.
 */
async function syncOwnerReferenceData(owner, selectedCollections = null) {
  const databaseUrl = decryptDatabaseUrl(owner?.databaseUrl);
  if (!databaseUrl) return { synced: false, error: 'Missing databaseUrl' };
  if (!/^mongodb(\+srv)?:\/\//i.test(databaseUrl)) {
    return {
      synced: false,
      error: 'Database URL must start with mongodb:// or mongodb+srv://',
    };
  }

  const selectedSet =
    Array.isArray(selectedCollections) && selectedCollections.length > 0
      ? new Set(selectedCollections.map((c) => String(c).trim()))
      : null;

  const modelsToSync = selectedSet
    ? REFERENCE_MODELS.filter((M) => selectedSet.has(M.collection.collectionName))
    : REFERENCE_MODELS;

  if (modelsToSync.length === 0) {
    return { synced: false, error: 'No valid master tables selected to seed' };
  }

  let ownerConn = null;
  try {
    ownerConn = await mongoose
      .createConnection(databaseUrl, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
      })
      .asPromise();

    // Never overwrite the central database itself
    if (
      mongoose.connection.readyState === 1 &&
      ownerConn.host === mongoose.connection.host &&
      ownerConn.name === mongoose.connection.name
    ) {
      return { synced: false, reason: 'Target database matches central database' };
    }

    const counts = {};
    let totalDocuments = 0;
    await Promise.all(
      modelsToSync.map(async (Model) => {
        const colName = Model.collection.collectionName;
        const docs = await Model.find(ACTIVE_FILTER).lean();
        if (!docs.length) {
          counts[colName] = 0;
          return;
        }

        const targetCol = ownerConn.db.collection(colName);
        const indexes = await targetCol.indexes().catch(() => []);
        const uniqueKeyGroups = indexes
          .filter((idx) => idx?.unique && idx?.key && !idx.key._id)
          .map((idx) => Object.keys(idx.key));

        // Build lookup maps for any unique indexes on the target collection so
        // records created with a different _id are updated in-place instead of failing E11000.
        const existingById = new Set();
        const existingByUniqueKey = new Map();
        if (uniqueKeyGroups.length > 0) {
          const projection = { _id: 1 };
          uniqueKeyGroups.forEach((fields) => fields.forEach((f) => { projection[f] = 1; }));
          const existingDocs = await targetCol.find({}, { projection }).toArray().catch(() => []);
          for (const ex of existingDocs) {
            existingById.add(String(ex._id));
            uniqueKeyGroups.forEach((fields, gIdx) => {
              const vals = fields.map((f) =>
                f.split('.').reduce((acc, part) => (acc != null ? acc[part] : undefined), ex)
              );
              if (vals.every((v) => v !== undefined && v !== null)) {
                existingByUniqueKey.set(`${gIdx}:${JSON.stringify(vals)}`, ex._id);
              }
            });
          }
        }

        const ops = docs.map((doc) => {
          const { _id, ...rest } = stripImageFields(doc);
          let targetId = _id;

          if (uniqueKeyGroups.length > 0 && !existingById.has(String(_id))) {
            for (let gIdx = 0; gIdx < uniqueKeyGroups.length; gIdx += 1) {
              const fields = uniqueKeyGroups[gIdx];
              const vals = fields.map((f) =>
                f.split('.').reduce((acc, part) => (acc != null ? acc[part] : undefined), rest)
              );
              if (vals.every((v) => v !== undefined && v !== null)) {
                const matchedId = existingByUniqueKey.get(`${gIdx}:${JSON.stringify(vals)}`);
                if (matchedId) {
                  targetId = matchedId;
                  break;
                }
              }
            }
          }

          return {
            updateOne: {
              filter: { _id: targetId },
              update: {
                $set: rest,
                $setOnInsert: { _id: targetId },
              },
              upsert: true,
            },
          };
        });

        await targetCol.bulkWrite(ops, { ordered: false });
        counts[colName] = docs.length;
        totalDocuments += docs.length;
      })
    );

    return {
      synced: true,
      collections: counts,
      totalDocuments,
    };
  } catch (err) {
    return {
      synced: false,
      error: err?.message || 'Failed to sync categories & master tables',
    };
  } finally {
    if (ownerConn) {
      try {
        await ownerConn.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}

module.exports = {
  syncOwnerReferenceData,
  getOwnerSeedPreview,
  stripImageFields,
  REFERENCE_MODELS,
};
