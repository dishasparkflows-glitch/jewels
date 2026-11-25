const mongoose = require('mongoose');
const { escapeRegex } = require('../../utils/string');
const Diamond = require('./diamond.model');
const DiamondColor = require('../diamondColor/diamondColor.model');
const DiamondClarity = require('../diamondClarity/diamondClarity.model');
const DiamondShape = require('../diamondShape/diamondShape.model');
const DiamondType = require('../diamondType/diamondType.model');
const DiamondSize = require('../diamondSize/diamondSize.model');
const MetalColor = require('../metalColor/metalColor.model');
const MetalPurity = require('../metalPurity/metalPurity.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

const POPULATE_FIELDS = [
  { path: 'colorId' },
  { path: 'clarityId' },
  { path: 'shapeId' },
  { path: 'typeId' },
];

function getSafePopulates() {
  return POPULATE_FIELDS;
}

async function resolveAttributeFilterIds(Model, rawValue) {
  if (!rawValue) return null;
  const parts = String(rawValue)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  const objectIds = [];
  const namePatterns = [];
  for (const part of parts) {
    if (mongoose.isValidObjectId(part)) {
      objectIds.push(new mongoose.Types.ObjectId(part));
    } else {
      namePatterns.push(new RegExp(`^${escapeRegex(part)}$`, 'i'));
    }
  }

  if (namePatterns.length > 0 && Model) {
    const matched = await Model.find({ name: { $in: namePatterns } })
      .select('_id')
      .lean();
    matched.forEach((doc) => objectIds.push(doc._id));
  }

  return objectIds.length > 0 ? { $in: objectIds } : { $in: [] };
}

class DiamondService {
  // ------------------------------- create diamond ----------------------------
  async create(data) {
    if (!data.shapeId && data.shape) data.shapeId = data.shape;
    if (!data.colorId && data.color) data.colorId = data.color;
    if (!data.clarityId && data.clarity) data.clarityId = data.clarity;
    if (!data.typeId && data.type) data.typeId = data.type;

    if (data.sku) {
      data.sku = data.sku.trim();
      const existing = await Diamond.findOne({ sku: data.sku });
      if (existing) {
        throw new ApiError(409, `Diamond with SKU "${data.sku}" already exists`);
      }
    }
    return await Diamond.create(data);
  }

  // ------------------------------- bulk create / upsert diamonds ----------------------------
  async bulkCreate(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new ApiError(400, 'Please provide an array of diamonds');
    }

    const bulkOps = items.map((d) => {
      const typeId = d.typeId || d.type;
      const shapeId = d.shapeId || d.shape;
      const colorId = d.colorId || d.color;
      const clarityId = d.clarityId || d.clarity;

      const doc = {
        sku: String(d.sku || '').trim(),
        title: String(d.title || '').trim(),
        description: d.description || '',
        price: parseFloat(d.price) || 0,
        rate: parseFloat(d.ratePerCarat || d.rate) || 0,
        carat: parseFloat(d.carat) || 0,
        typeId,
        shapeId,
        colorId,
        clarityId,
        status: d.status || 'active',
      };

      if (d.image?.url) {
        doc.image = { url: d.image.url, key: d.image.key, public_id: d.image.public_id };
      }

      const update = { $set: doc };
      if (d._id) {
        return {
          updateOne: {
            filter: { _id: d._id },
            update,
            upsert: true,
          },
        };
      }
      return {
        updateOne: {
          filter: { sku: doc.sku },
          update,
          upsert: true,
        },
      };
    });

    const result = await Diamond.bulkWrite(bulkOps);
    return {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      upsertedCount: result.upsertedCount,
      insertedCount: result.insertedCount,
      count: items.length,
    };
  }

  // ------------------------------- batch validate diamonds ----------------------------
  async validate(diamonds = []) {
    if (!Array.isArray(diamonds) || diamonds.length === 0) {
      return { existingDiamonds: [] };
    }

    const orConditions = [];
    for (const d of diamonds) {
      const caratNum = parseFloat(d.carat);
      const typeId = d.typeId || d.type;
      const shapeId = d.shapeId || d.shape;
      const colorId = d.colorId || d.color;
      const clarityId = d.clarityId || d.clarity;

      if (!isNaN(caratNum) && typeId && shapeId && colorId && clarityId) {
        orConditions.push({
          carat: caratNum,
          typeId,
          shapeId,
          colorId,
          clarityId,
        });
      }
      if (d.sku && typeof d.sku === 'string' && d.sku.trim()) {
        orConditions.push({ sku: d.sku.trim() });
      }
    }

    if (orConditions.length === 0) {
      return { existingDiamonds: [] };
    }

    const existing = await Diamond.find({
      $or: orConditions,
      'meta.deletedAt': null,
    }).populate(getSafePopulates()).lean();

    return { existingDiamonds: existing };
  }

  // ------------------------------- get one diamond ----------------------------

  async getOne(id) {
    const cleanId = String(id || '').trim();
    const filter = mongoose.isValidObjectId(cleanId)
      ? { _id: cleanId }
      : { sku: cleanId };
    let query = Diamond.findOne(filter);
    const populates = getSafePopulates();
    if (populates.length > 0) {
      query = query.populate(populates);
    }
    const item = await query.lean();

    if (!item) {
      throw new ApiError(404, 'Diamond not found');
    }
    return item;
  }

  async getBySku(sku) {
    let query = Diamond.findOne({
      sku: sku.trim(),
    });
    const populates = getSafePopulates();
    if (populates.length > 0) {
      query = query.populate(populates);
    }
    const item = await query.lean();

    if (!item) {
      throw new ApiError(404, `Diamond with SKU "${sku}" not found`);
    }
    return item;
  }

  // ------------------------------- get all diamonds ----------------------------

  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    const isForWeb = queryParams.forweb === true || queryParams.forweb === 'true';
    if (isForWeb) {
      filter.status = queryParams.status || 'active';
      filter['visibility.web'] = { $ne: false };
    } else if (queryParams.status) {
      filter.status = queryParams.status;
    }

    const resolvedColorVal = queryParams.colorId || queryParams.color || queryParams.diamondColor;
    const resolvedClarityVal = queryParams.clarityId || queryParams.clarity || queryParams.diamondClarity;
    const resolvedShapeVal = queryParams.shapeId || queryParams.shape || queryParams.diamondShape;
    const resolvedTypeVal = queryParams.typeId || queryParams.type || queryParams.diamondType;

    const [colorFilter, clarityFilter, shapeFilter, typeFilter] = await Promise.all([
      resolveAttributeFilterIds(DiamondColor, resolvedColorVal),
      resolveAttributeFilterIds(DiamondClarity, resolvedClarityVal),
      resolveAttributeFilterIds(DiamondShape, resolvedShapeVal),
      resolveAttributeFilterIds(DiamondType, resolvedTypeVal),
    ]);

    if (colorFilter) filter.colorId = colorFilter;
    if (clarityFilter) filter.clarityId = clarityFilter;
    if (shapeFilter) filter.shapeId = shapeFilter;
    if (typeFilter) filter.typeId = typeFilter;

    if (queryParams.carat) {
      const caratValues = String(queryParams.carat)
        .split(',')
        .map((s) => Number(s.trim().replace(/[^\d.]/g, '')))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (caratValues.length > 0) {
        filter.carat = { $in: caratValues };
      }
    } else if (queryParams.minCarat || queryParams.maxCarat) {
      filter.carat = {};
      if (queryParams.minCarat) filter.carat.$gte = Number(queryParams.minCarat);
      if (queryParams.maxCarat) filter.carat.$lte = Number(queryParams.maxCarat);
    }

    if (queryParams.minPrice || queryParams.maxPrice) {
      filter.price = {};
      if (queryParams.minPrice) filter.price.$gte = Number(queryParams.minPrice);
      if (queryParams.maxPrice) filter.price.$lte = Number(queryParams.maxPrice);
    }

    if (queryParams.search) {
      filter.$or = [
        { sku: new RegExp(escapeRegex(queryParams.search.trim()), 'i') },
        { title: new RegExp(escapeRegex(queryParams.search.trim()), 'i') },
        { description: new RegExp(escapeRegex(queryParams.search.trim()), 'i') },
      ];
    }

    const sortMap = {
      'price-asc': { price: 1, _id: -1 },
      'price-desc': { price: -1, _id: -1 },
      'carat-asc': { carat: 1, price: 1 },
      'carat-desc': { carat: -1, price: -1 },
      popular: { 'demoMetrics.soldCount': -1, _id: -1 },
      newest: { _id: -1 },
    };
    const sort = sortMap[queryParams.sort] || { _id: -1 };

    let findQuery = Diamond.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const populates = getSafePopulates();
    if (populates.length > 0) {
      findQuery = findQuery.populate(populates);
    }

    const [items, total] = await Promise.all([
      findQuery.lean(),
      Diamond.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get diamond lookup ----------------------------

  async getLookup(queryParams = {}) {
    const filter = { 'meta.deletedAt': null, status: 'active' };

    const resolvedColorId = queryParams.colorId || queryParams.color;
    const resolvedClarityId = queryParams.clarityId || queryParams.clarity;
    const resolvedShapeId = queryParams.shapeId || queryParams.shape;
    const resolvedTypeId = queryParams.typeId || queryParams.type;

    if (resolvedColorId) filter.colorId = resolvedColorId;
    if (resolvedClarityId) filter.clarityId = resolvedClarityId;
    if (resolvedShapeId) filter.shapeId = resolvedShapeId;
    if (resolvedTypeId) filter.typeId = resolvedTypeId;

    return await Diamond.find(filter)
      .select('_id sku title price carat rate image colorId clarityId shapeId typeId')
      .sort({ carat: 1, price: 1 })
      .lean();
  }

  // ------------------------------- update diamond ----------------------------

  async update(id, data) {
    if (!data.shapeId && data.shape) data.shapeId = data.shape;
    if (!data.colorId && data.color) data.colorId = data.color;
    if (!data.clarityId && data.clarity) data.clarityId = data.clarity;
    if (!data.typeId && data.type) data.typeId = data.type;

    if (data.sku) {
      data.sku = data.sku.trim();
      const existing = await Diamond.findOne({
        sku: data.sku,
        _id: { $ne: id },
      });
      if (existing) {
        throw new ApiError(409, `Diamond with SKU "${data.sku}" already exists`);
      }
    }

    let updateQuery = Diamond.findOneAndUpdate(
      { _id: id },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    );

    const populates = getSafePopulates();
    if (populates.length > 0) {
      updateQuery = updateQuery.populate(populates);
    }

    const item = await updateQuery;

    if (!item) {
      throw new ApiError(404, 'Diamond not found');
    }

    return item;
  }

  // ------------------------------- delete diamond ----------------------------

  async delete(id) {
    const item = await Diamond.findOneAndUpdate(
      { _id: id },
      { $set: { status: 'inactive', 'meta.deletedAt': new Date() } },
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'Diamond not found');
    }

    return { message: 'Diamond deleted successfully', id };
  }

  // ------------------------------- bulk delete diamonds ----------------------------

  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, 'Please provide an array of diamond IDs to delete');
    }

    const result = await Diamond.updateMany(
      { _id: { $in: ids } },
      { $set: { status: 'inactive', 'meta.deletedAt': new Date() } }
    );

    return {
      message: `${result.modifiedCount} diamond(s) deleted successfully`,
      deletedCount: result.modifiedCount,
      ids,
    };
  }

  // ------------------------------- get diamond options & attributes (combined lookup) ----------------------------

  async getDiamondOptions() {
    const filter = { 'meta.deletedAt': null, status: 'active' };

    const [
      colors,
      clarities,
      shapes,
      types,
      sizes,
      metalColors,
      metalPurities,
    ] = await Promise.all([
      DiamondColor.find(filter).sort({ name: 1 }).select('_id name image status').lean(),
      DiamondClarity.find(filter).sort({ name: 1 }).select('_id name image status').lean(),
      DiamondShape.find(filter).sort({ name: 1 }).select('_id name image icon status').lean(),
      DiamondType.find(filter).sort({ name: 1 }).select('_id name status').lean(),
      DiamondSize.find(filter).sort({ name: 1 }).select('_id name sizeFrom sizeTo status').lean(),
      MetalColor.find(filter).sort({ name: 1 }).select('_id name colorCode colorCodeEnd status').lean(),
      MetalPurity.find(filter).sort({ order: 1, karat: 1, name: 1 }).select('_id name metalType karat order purityPercent status').lean(),
    ]);

    return {
      diamondColors: colors,
      diamondClarities: clarities,
      diamondCuts: [],
      diamondShapes: shapes,
      diamondTypes: types,
      diamondSizes: sizes,
      sieveSizes: [],
      metalColors,
      metalPurities,
    };
  }
}

module.exports = new DiamondService();
