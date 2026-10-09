const Coupon = require('./coupon.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class CouponService {
  // ------------------------------- create coupon ----------------------------
  async create(data) {
    if (data.coupon?.code) {
      data.coupon.code = data.coupon.code.trim().toUpperCase();
      const existing = await Coupon.findOne({
        'coupon.code': data.coupon.code,
        isDeleted: false,
      });
      if (existing) {
        throw new ApiError(409, `Coupon with code "${data.coupon.code}" already exists`);
      }
    }
    return await Coupon.create(data);
  }

  // ------------------------------- get one coupon ----------------------------
  async getOne(id) {
    const coupon = await Coupon.findOne({ _id: id, isDeleted: false });
    if (!coupon) {
      throw new ApiError(404, 'Coupon not found');
    }
    return coupon;
  }

  // ------------------------------- get coupon by code ----------------------------
  async getByCode(code) {
    const coupon = await Coupon.findOne({
      'coupon.code': code.trim().toUpperCase(),
      isDeleted: false,
    });
    if (!coupon) {
      throw new ApiError(404, 'Coupon not found');
    }
    return coupon;
  }

  // ------------------------------- get all coupons ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { isDeleted: false };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }
    if (queryParams.discounttype) {
      filter['discount.type'] = queryParams.discounttype;
    }
    if (queryParams.search) {
      const reg = new RegExp(queryParams.search, 'i');
      filter.$or = [
        { 'coupon.code': reg },
        { 'coupon.description': reg },
      ];
    }

    const [items, total] = await Promise.all([
      Coupon.find(filter)
        .sort({ 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Coupon.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get coupon lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { isDeleted: false, status: 'active' };
    const now = new Date();

    // Only return currently valid coupons in active lookup
    filter.$or = [
      { 'validity.endDate': null },
      { 'validity.endDate': { $gte: now } },
    ];

    return await Coupon.find(filter)
      .select('_id coupon discount validity usage status meta')
      .sort({ 'coupon.code': 1 })
      .lean();
  }

  // ------------------------------- validate coupon ----------------------------
  async validateCoupon(code, cartAmount = 0) {
    if (!code) {
      throw new ApiError(400, 'Coupon code is required');
    }

    const coupon = await Coupon.findOne({
      'coupon.code': code.trim().toUpperCase(),
      isDeleted: false,
    });

    if (!coupon) {
      throw new ApiError(404, 'Invalid coupon code');
    }

    if (coupon.status !== 'active') {
      throw new ApiError(400, 'This coupon is currently inactive');
    }

    const now = new Date();
    if (coupon.validity?.startDate && now < new Date(coupon.validity.startDate)) {
      throw new ApiError(400, 'This coupon has not started yet');
    }

    if (coupon.validity?.endDate && now > new Date(coupon.validity.endDate)) {
      throw new ApiError(400, 'This coupon has expired');
    }

    const usageLimit = coupon.usage?.usageLimit;
    const usedCount = coupon.usage?.usedCount || 0;
    if (usageLimit && usedCount >= usageLimit) {
      throw new ApiError(400, 'This coupon has reached its maximum usage limit');
    }

    const amount = Number(cartAmount) || 0;
    const minOrder = coupon.discount?.minimumOrderAmount || 0;
    if (amount < minOrder) {
      throw new ApiError(
        400,
        `Minimum order amount of ₹${minOrder} required for this coupon`
      );
    }

    let discountAmount = 0;
    const discountType = coupon.discount?.type || 'Percentage';
    const discountValue = coupon.discount?.value || 0;
    if (discountType === 'Percentage') {
      discountAmount = (amount * discountValue) / 100;
    } else {
      discountAmount = Math.min(discountValue, amount);
    }

    discountAmount = Math.round(discountAmount * 100) / 100;
    const finalAmount = Math.max(0, amount - discountAmount);

    return {
      isValid: true,
      couponId: coupon._id,
      coupon: coupon.coupon,
      discount: coupon.discount,
      discountAmount,
      finalAmount,
    };
  }

  // ------------------------------- update coupon ----------------------------
  async update(id, data) {
    if (data.coupon?.code) {
      data.coupon.code = data.coupon.code.trim().toUpperCase();
      const existing = await Coupon.findOne({
        'coupon.code': data.coupon.code,
        _id: { $ne: id },
        isDeleted: false,
      });
      if (existing) {
        throw new ApiError(409, `Coupon with code "${data.coupon.code}" already exists`);
      }
    }

    const coupon = await Coupon.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    );

    if (!coupon) {
      throw new ApiError(404, 'Coupon not found');
    }

    return coupon;
  }

  // ------------------------------- delete coupon ----------------------------
  async delete(id) {
    const coupon = await Coupon.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, status: 'inactive' } },
      { returnDocument: 'after' }
    );

    if (!coupon) {
      throw new ApiError(404, 'Coupon not found');
    }

    return { message: 'Coupon deleted successfully', id };
  }
}

module.exports = new CouponService();
