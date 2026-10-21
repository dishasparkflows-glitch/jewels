const mongoose = require('mongoose');
const DiamondPriceNew = require('./diamondPriceNew.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

function getSafePopulates() {
  const fields = [];
  if (mongoose.models['DiamondType']) fields.push({ path: 'diamondTypeId', select: '_id name' });
  if (mongoose.models['DiamondShape']) fields.push({ path: 'diamondShapeId', select: '_id name' });
  if (mongoose.models['DiamondClarity']) fields.push({ path: 'diamondClarityId', select: '_id name' });
  if (mongoose.models['DiamondColor']) fields.push({ path: 'diamondColorId', select: '_id name' });
  return fields;
}

class DiamondPriceNewService {
  // ------------------------------- create diamond price new ----------------------------
  async create(data) {
    const existing = await DiamondPriceNew.findOne({
      diamondTypeId: data.diamondTypeId,
      diamondShapeId: data.diamondShapeId,
      diamondClarityId: data.diamondClarityId,
      diamondColorId: data.diamondColorId,
    });

    if (existing) {
      throw new ApiError(
        409,
        'Diamond price configuration already exists for this combination'
      );
    }

    return await DiamondPriceNew.create(data);
  }

  // ------------------------------- get one diamond price new ----------------------------

  async getOne(id) {
    let query = DiamondPriceNew.findOne({ _id: id });
    const populates = getSafePopulates();
    if (populates.length > 0) query = query.populate(populates);
    const item = await query.lean();

    if (!item) {
      throw new ApiError(404, 'Diamond price configuration not found');
    }
    return item;
  }

  // ------------------------------- get all diamond prices new ----------------------------

  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    if (queryParams.diamondTypeId) filter.diamondTypeId = queryParams.diamondTypeId;
    if (queryParams.diamondShapeId) filter.diamondShapeId = queryParams.diamondShapeId;
    if (queryParams.diamondClarityId) filter.diamondClarityId = queryParams.diamondClarityId;
    if (queryParams.diamondColorId) filter.diamondColorId = queryParams.diamondColorId;

    let findQuery = DiamondPriceNew.find(filter)
      .sort({ 'meta.createdAt': -1 })
      .skip(skip)
      .limit(limit);

    const populates = getSafePopulates();
    if (populates.length > 0) findQuery = findQuery.populate(populates);

    const [items, total] = await Promise.all([
      findQuery.lean(),
      DiamondPriceNew.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get diamond price new lookup ----------------------------

  async getLookup(queryParams = {}) {
    const filter = { 'meta.deletedAt': null };

    if (queryParams.diamondTypeId) filter.diamondTypeId = queryParams.diamondTypeId;
    if (queryParams.diamondShapeId) filter.diamondShapeId = queryParams.diamondShapeId;
    if (queryParams.diamondClarityId) filter.diamondClarityId = queryParams.diamondClarityId;
    if (queryParams.diamondColorId) filter.diamondColorId = queryParams.diamondColorId;

    return await DiamondPriceNew.find(filter)
      .select(
        '_id diamondTypeId diamondShapeId diamondClarityId diamondColorId centerDiamond sideDiamonds'
      )
      .lean();
  }

  // ------------------------------- update diamond price new ----------------------------

  async update(id, data) {
    let updateQuery = DiamondPriceNew.findOneAndUpdate(
      { _id: id },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    );

    const populates = getSafePopulates();
    if (populates.length > 0) updateQuery = updateQuery.populate(populates);

    const item = await updateQuery;

    if (!item) {
      throw new ApiError(404, 'Diamond price configuration not found');
    }

    return item;
  }

  // ------------------------------- delete diamond price new ----------------------------

  async delete(id) {
    const item = await DiamondPriceNew.findOneAndUpdate(
      { _id: id },
      { $set: { 'meta.deletedAt': new Date() } },
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'Diamond price configuration not found');
    }

    return { message: 'Diamond price configuration deleted successfully', id };
  }
}

module.exports = new DiamondPriceNewService();
