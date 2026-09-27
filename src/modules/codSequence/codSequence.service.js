const CodSequence = require('./codSequence.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class CodSequenceService {
  // ------------------------------- create cod sequence ----------------------------
  async create(data) {
    return await CodSequence.create(data);
  }

  // ------------------------------- get one cod sequence ----------------------------

  async getOne(id) {
    const item = await CodSequence.findOne({ _id: id, isDeleted: false });
    if (!item) {
      throw new ApiError(404, 'COD sequence tier not found');
    }
    return item;
  }

  // ------------------------------- get all cod sequences ----------------------------

  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { isDeleted: false };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    if (queryParams.search) {
      const amount = Number(queryParams.search);
      if (!isNaN(amount)) {
        filter.uptoAmount = amount;
      }
    }

    const [items, total] = await Promise.all([
      CodSequence.find(filter)
        .sort({ uptoAmount: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CodSequence.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get cod sequence lookup ----------------------------

  async getLookup(queryParams = {}) {
    const filter = { isDeleted: false, status: 'active' };
    return await CodSequence.find(filter)
      .sort({ uptoAmount: 1 })
      .select('_id uptoAmount chargeType chargeValue status')
      .lean();
  }

  async calculateFee(orderAmount) {
    const amount = Number(orderAmount);
    if (isNaN(amount) || amount < 0) {
      throw new ApiError(400, 'Invalid order amount');
    }

    // Find the lowest tier where uptoAmount >= orderAmount
    const tier = await CodSequence.findOne({
      isDeleted: false,
      status: 'active',
      uptoAmount: { $gte: amount },
    }).sort({ uptoAmount: 1 });

    if (!tier) {
      return {
        isAvailable: false,
        charge: 0,
        message: 'COD is not available for this amount',
      };
    }

    let charge = 0;
    if (tier.chargeType === 'Percentage') {
      charge = (amount * tier.chargeValue) / 100;
    } else {
      charge = tier.chargeValue;
    }

    return {
      isAvailable: true,
      chargeType: tier.chargeType,
      chargeValue: tier.chargeValue,
      calculatedCharge: Math.round(charge * 100) / 100,
      tierId: tier._id,
    };
  }

  // ------------------------------- update cod sequence ----------------------------

  async update(id, data) {
    const item = await CodSequence.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'COD sequence tier not found');
    }

    return item;
  }

  // ------------------------------- delete cod sequence ----------------------------

  async delete(id) {
    const item = await CodSequence.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'COD sequence tier not found');
    }

    return { message: 'COD sequence tier deleted successfully', id };
  }
}

module.exports = new CodSequenceService();
