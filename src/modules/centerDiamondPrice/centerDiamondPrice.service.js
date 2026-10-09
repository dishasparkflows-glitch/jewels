const CenterDiamondPrice = require('./centerDiamondPrice.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class CenterDiamondPriceService {
  // ------------------------------- create center diamond price ----------------------------
  async create(data) {
    const existing = await CenterDiamondPrice.findOne({
      diamondTypeId: data.diamondTypeId,
      diamondShapeId: data.diamondShapeId,
      diamondClarityId: data.diamondClarityId,
      diamondColorId: data.diamondColorId,
      sizeFrom: data.sizeFrom || 0,
      sizeTo: data.sizeTo || 0,
      isDeleted: false,
    });

    if (existing) {
      throw new ApiError(
        409,
        'A diamond price configuration already exists for this exact combination and size range'
      );
    }

    return await CenterDiamondPrice.create(data);
  }

  // ------------------------------- get one center diamond price ----------------------------

  async getOne(id) {
    const item = await CenterDiamondPrice.findOne({ _id: id, isDeleted: false });
    if (!item) {
      throw new ApiError(404, 'Diamond price configuration not found');
    }
    return item;
  }

  // ------------------------------- get all center diamond prices ----------------------------

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

    const [items, total] = await Promise.all([
      CenterDiamondPrice.find(filter)
        .sort({ 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CenterDiamondPrice.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get center diamond price lookup ----------------------------

  async getLookup(queryParams = {}) {
    const filter = { isDeleted: false };

    if (queryParams.diamondTypeId) filter.diamondTypeId = queryParams.diamondTypeId;
    if (queryParams.diamondShapeId) filter.diamondShapeId = queryParams.diamondShapeId;
    if (queryParams.diamondClarityId) filter.diamondClarityId = queryParams.diamondClarityId;
    if (queryParams.diamondColorId) filter.diamondColorId = queryParams.diamondColorId;

    return await CenterDiamondPrice.find(filter)
      .select('_id diamondTypeId diamondShapeId diamondClarityId diamondColorId priceINR priceUSD sizeFrom sizeTo')
      .lean();
  }

  // ------------------------------- update center diamond price ----------------------------

  async update(id, data) {
    const item = await CenterDiamondPrice.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Diamond price configuration not found');
    }

    return item;
  }

  // ------------------------------- delete center diamond price ----------------------------

  async delete(id) {
    const item = await CenterDiamondPrice.findOneAndUpdate(
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

module.exports = new CenterDiamondPriceService();
