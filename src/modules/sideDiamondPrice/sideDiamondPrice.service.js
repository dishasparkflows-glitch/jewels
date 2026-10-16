const mongoose = require('mongoose');
const SideDiamondPrice = require('./sideDiamondPrice.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

function getSafePopulates() {
  const fields = [];
  if (mongoose.models['DiamondType']) fields.push({ path: 'diamondTypeId' });
  if (mongoose.models['DiamondShape']) fields.push({ path: 'diamondShapeId' });
  if (mongoose.models['DiamondClarity']) fields.push({ path: 'diamondClarityId' });
  if (mongoose.models['DiamondColor']) fields.push({ path: 'diamondColorId' });
  return fields;
}

class SideDiamondPriceService {
  // ------------------------------- create side diamond price ----------------------------
  async create(data) {
    const existing = await SideDiamondPrice.findOne({
      diamondTypeId: data.diamondTypeId,
      diamondShapeId: data.diamondShapeId,
      diamondClarityId: data.diamondClarityId,
      diamondColorId: data.diamondColorId,
      sizeFrom: data.sizeFrom,
      sizeTo: data.sizeTo,
    });

    if (existing) {
      throw new ApiError(
        409,
        'Side diamond price entry already exists for this exact combination and size range'
      );
    }

    return await SideDiamondPrice.create(data);
  }

  // ------------------------------- get one side diamond price ----------------------------

  async getOne(id) {
    let query = SideDiamondPrice.findOne({ _id: id });
    const populates = getSafePopulates();
    if (populates.length > 0) query = query.populate(populates);
    const item = await query.lean();

    if (!item) {
      throw new ApiError(404, 'Side diamond price entry not found');
    }
    return item;
  }

  // ------------------------------- get all side diamond prices ----------------------------

  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    if (queryParams.diamondTypeId) filter.diamondTypeId = queryParams.diamondTypeId;
    if (queryParams.diamondShapeId) filter.diamondShapeId = queryParams.diamondShapeId;
    if (queryParams.diamondClarityId) filter.diamondClarityId = queryParams.diamondClarityId;
    if (queryParams.diamondColorId) filter.diamondColorId = queryParams.diamondColorId;

    if (queryParams.caratSize) {
      const size = Number(queryParams.caratSize);
      filter.sizeFrom = { $lte: size };
      filter.sizeTo = { $gte: size };
    }

    let findQuery = SideDiamondPrice.find(filter)
      .sort({ 'meta.createdAt': -1 })
      .skip(skip)
      .limit(limit);

    const populates = getSafePopulates();
    if (populates.length > 0) findQuery = findQuery.populate(populates);

    const [items, total] = await Promise.all([
      findQuery.lean(),
      SideDiamondPrice.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get side diamond price lookup ----------------------------

  async getLookup(queryParams = {}) {
    const filter = { 'meta.deletedAt': null };

    if (queryParams.diamondTypeId) filter.diamondTypeId = queryParams.diamondTypeId;
    if (queryParams.diamondShapeId) filter.diamondShapeId = queryParams.diamondShapeId;
    if (queryParams.diamondClarityId) filter.diamondClarityId = queryParams.diamondClarityId;
    if (queryParams.diamondColorId) filter.diamondColorId = queryParams.diamondColorId;

    return await SideDiamondPrice.find(filter)
      .select(
        '_id diamondTypeId diamondShapeId diamondClarityId diamondColorId sizeFrom sizeTo priceINR priceUSD'
      )
      .sort({ sizeFrom: 1 })
      .lean();
  }

  // ------------------------------- update side diamond price ----------------------------

  async update(id, data) {
    let updateQuery = SideDiamondPrice.findOneAndUpdate(
      { _id: id },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    );

    const populates = getSafePopulates();
    if (populates.length > 0) updateQuery = updateQuery.populate(populates);

    const item = await updateQuery;

    if (!item) {
      throw new ApiError(404, 'Side diamond price entry not found');
    }

    return item;
  }

  // ------------------------------- bulk save side diamond prices ------------------------

  async bulkSave(items = [], userId = null) {
    if (!Array.isArray(items)) return { count: 0, items: [] };
    const saved = [];
    for (const item of items) {
      const id = item._id || item.id;
      const data = {
        diamondTypeId: item.diamondTypeId?._id || item.diamondTypeId,
        diamondShapeId: item.diamondShapeId?._id || item.diamondShapeId,
        diamondColorId: item.diamondColorId?._id || item.diamondColorId,
        diamondClarityId: item.diamondClarityId?._id || item.diamondClarityId,
        sizeFrom: Number(item.sizeFrom) || 0,
        sizeTo: Number(item.sizeTo) || 0,
        priceINR: Number(item.priceINR) || 0,
        priceUSD: Number(item.priceUSD) || 0,
        updatedBy: userId || null,
        
      };

      if (!data.diamondTypeId || !data.diamondShapeId || !data.diamondColorId || !data.diamondClarityId) {
        continue;
      }

      if (item.isDeleted && id && !String(id).startsWith('new_')) {
        await SideDiamondPrice.findByIdAndUpdate(id, { $set: { 'meta.deletedAt': new Date() } });
        continue;
      }

      if (id && !String(id).startsWith('new_')) {
        const updated = await SideDiamondPrice.findByIdAndUpdate(
          id,
          { $set: data },
          { returnDocument: 'after', runValidators: true }
        );
        if (updated) saved.push(updated);
      } else {
        const existing = await SideDiamondPrice.findOne({
          diamondTypeId: data.diamondTypeId,
          diamondShapeId: data.diamondShapeId,
          diamondColorId: data.diamondColorId,
          diamondClarityId: data.diamondClarityId,
          sizeFrom: data.sizeFrom,
          sizeTo: data.sizeTo,
        });

        if (existing) {
          const updated = await SideDiamondPrice.findByIdAndUpdate(
            existing._id,
            { $set: data },
            { returnDocument: 'after' }
          );
          if (updated) saved.push(updated);
        } else {
          const created = await SideDiamondPrice.create(data);
          if (created) saved.push(created);
        }
      }
    }
    return { count: saved.length, items: saved };
  }

  // ------------------------------- delete side diamond price ----------------------------

  async delete(id) {
    const item = await SideDiamondPrice.findOneAndUpdate(
      { _id: id },
      { $set: { 'meta.deletedAt': new Date() } },
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'Side diamond price entry not found');
    }

    return { message: 'Side diamond price entry deleted successfully', id };
  }
}

module.exports = new SideDiamondPriceService();
