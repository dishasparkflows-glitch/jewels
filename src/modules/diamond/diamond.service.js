const mongoose = require('mongoose');
const Diamond = require('./diamond.model');
const DiamondColor = require('../diamondColor/diamondColor.model');
const DiamondClarity = require('../diamondClarity/diamondClarity.model');
const DiamondShape = require('../diamondShape/diamondShape.model');
const DiamondType = require('../diamondType/diamondType.model');
const DiamondCut = require('../diamondCut/diamondCut.model');
const DiamondSize = require('../diamondSize/diamondSize.model');
const SieveSize = require('../sieveSize/sieveSize.model');
const MetalColor = require('../metalColor/metalColor.model');
const MetalPurity = require('../metalPurity/metalPurity.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

function getSafePopulates() {
  const fields = [];
  if (mongoose.models['DiamondColor']) fields.push({ path: 'colorId' });
  if (mongoose.models['DiamondClarity']) fields.push({ path: 'clarityId' });
  if (mongoose.models['DiamondShape']) fields.push({ path: 'shapeId' });
  if (mongoose.models['DiamondType']) fields.push({ path: 'typeId' });
  return fields;
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
    let query = Diamond.findOne({ _id: id });
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

    if (queryParams.status) filter.status = queryParams.status;
    const resolvedColorId = queryParams.colorId || queryParams.color;
    const resolvedClarityId = queryParams.clarityId || queryParams.clarity;
    const resolvedShapeId = queryParams.shapeId || queryParams.shape;
    const resolvedTypeId = queryParams.typeId || queryParams.type;

    if (resolvedColorId) filter.colorId = resolvedColorId;
    if (resolvedClarityId) filter.clarityId = resolvedClarityId;
    if (resolvedShapeId) filter.shapeId = resolvedShapeId;
    if (resolvedTypeId) filter.typeId = resolvedTypeId;

    if (queryParams.minCarat || queryParams.maxCarat) {
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
        { sku: new RegExp(queryParams.search, 'i') },
        { title: new RegExp(queryParams.search, 'i') },
        { description: new RegExp(queryParams.search, 'i') },
      ];
    }

    let findQuery = Diamond.find(filter)
      .sort({ 'meta.createdAt': -1 })
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

  // ------------------------------- get diamond options & attributes (combined lookup) ----------------------------

  async getDiamondOptions() {
    const filter = { 'meta.deletedAt': null, status: 'active' };

    const [
      colors,
      clarities,
      cuts,
      shapes,
      types,
      sizes,
      sieveSizes,
      metalColors,
      metalPurities,
    ] = await Promise.all([
      DiamondColor.find(filter).sort({ name: 1 }).select('_id name image status').lean(),
      DiamondClarity.find(filter).sort({ name: 1 }).select('_id name image status').lean(),
      DiamondCut.find(filter).sort({ name: 1 }).select('_id name image status').lean(),
      DiamondShape.find(filter).sort({ name: 1 }).select('_id name image icon status').lean(),
      DiamondType.find(filter).sort({ name: 1 }).select('_id name status').lean(),
      DiamondSize.find(filter).sort({ name: 1 }).select('_id name sizeFrom sizeTo status').lean(),
      SieveSize.find(filter).sort({ name: 1 }).select('_id name status').lean(),
      MetalColor.find(filter).sort({ name: 1 }).select('_id name colorCode colorCodeEnd status').lean(),
      MetalPurity.find(filter).sort({ order: 1, karat: 1, name: 1 }).select('_id name metalType karat order purityPercent status').lean(),
    ]);

    return {
      colors,
      diamondColors: colors,
      clarities,
      diamondClarities: clarities,
      cuts,
      diamondCuts: cuts,
      shapes,
      diamondShapes: shapes,
      types,
      diamondTypes: types,
      sizes,
      diamondSizes: sizes,
      sieveSizes,
      metalColors,
      metalPurities,
    };
  }
}

module.exports = new DiamondService();
