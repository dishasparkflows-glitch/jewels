const mongoose = require('mongoose');
const DiamondPriceNew = require('./diamondPriceNew.model');
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

class DiamondPriceNewService {
  // ------------------------------- create diamond price new ----------------------------
  async create(data) {
    const existing = await DiamondPriceNew.findOne({
      diamondTypeId: data.diamondTypeId,
      diamondShapeId: data.diamondShapeId,
      diamondClarityId: data.diamondClarityId,
      diamondColorId: data.diamondColorId,
      isDeleted: false,
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
    let query = DiamondPriceNew.findOne({ _id: id, isDeleted: false });
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
    const filter = { isDeleted: false };

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
    const filter = { isDeleted: false };

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
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
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
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'Diamond price configuration not found');
    }

    return { message: 'Diamond price configuration deleted successfully', id };
  }
}

module.exports = new DiamondPriceNewService();
