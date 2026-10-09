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
      isDeleted: false,
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
    let query = SideDiamondPrice.findOne({ _id: id, isDeleted: false });
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
    const filter = { isDeleted: false };

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
    const filter = { isDeleted: false };

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
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );

    const populates = getSafePopulates();
    if (populates.length > 0) updateQuery = updateQuery.populate(populates);

    const item = await updateQuery;

    if (!item) {
      throw new ApiError(404, 'Side diamond price entry not found');
    }

    return item;
  }

  // ------------------------------- delete side diamond price ----------------------------

  async delete(id) {
    const item = await SideDiamondPrice.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'Side diamond price entry not found');
    }

    return { message: 'Side diamond price entry deleted successfully', id };
  }
}

module.exports = new SideDiamondPriceService();
