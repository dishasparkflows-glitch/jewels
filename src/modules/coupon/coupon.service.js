const Coupon = require('./coupon.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class CouponService {
  // ------------------------------- create coupon ----------------------------
  async create(data) {
    if (data.couponcode) {
      data.couponcode = data.couponcode.trim().toUpperCase();
      const existing = await Coupon.findOne({
        couponcode: data.couponcode,
        isDeleted: false,
      });
      if (existing) {
        throw new ApiError(409, `Coupon with code "${data.couponcode}" already exists`);
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
      couponcode: code.trim().toUpperCase(),
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
      filter.discounttype = queryParams.discounttype;
    }
    if (queryParams.search) {
      filter.$or = [
        { couponcode: new RegExp(queryParams.search, 'i') },
        { description: new RegExp(queryParams.search, 'i') },
      ];
    }

    const [items, total] = await Promise.all([
      Coupon.find(filter)
        .sort({ createdAt: -1 })
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
      { enddate: null },
      { enddate: { $gte: now } },
    ];

    return await Coupon.find(filter)
      .select('_id couponcode description discounttype discountvalue minimumorderamount')
      .sort({ couponcode: 1 })
      .lean();
  }

  // ------------------------------- validate coupon ----------------------------
  async validateCoupon(code, cartAmount = 0) {
    if (!code) {
      throw new ApiError(400, 'Coupon code is required');
    }

    const coupon = await Coupon.findOne({
      couponcode: code.trim().toUpperCase(),
      isDeleted: false,
    });

    if (!coupon) {
      throw new ApiError(404, 'Invalid coupon code');
    }

    if (coupon.status !== 'active') {
      throw new ApiError(400, 'This coupon is currently inactive');
    }

    const now = new Date();
    if (coupon.startdate && now < new Date(coupon.startdate)) {
      throw new ApiError(400, 'This coupon has not started yet');
    }

    if (coupon.enddate && now > new Date(coupon.enddate)) {
      throw new ApiError(400, 'This coupon has expired');
    }

    if (coupon.usagelimit && coupon.usedCount >= coupon.usagelimit) {
      throw new ApiError(400, 'This coupon has reached its maximum usage limit');
    }

    const amount = Number(cartAmount) || 0;
    if (amount < coupon.minimumorderamount) {
      throw new ApiError(
        400,
        `Minimum order amount of ₹${coupon.minimumorderamount} required for this coupon`
      );
    }

    let discountAmount = 0;
    if (coupon.discounttype === 'Percentage') {
      discountAmount = (amount * coupon.discountvalue) / 100;
    } else {
      discountAmount = Math.min(coupon.discountvalue, amount);
    }

    discountAmount = Math.round(discountAmount * 100) / 100;
    const finalAmount = Math.max(0, amount - discountAmount);

    return {
      isValid: true,
      couponId: coupon._id,
      couponcode: coupon.couponcode,
      discounttype: coupon.discounttype,
      discountvalue: coupon.discountvalue,
      discountAmount,
      finalAmount,
      description: coupon.description,
    };
  }

  // ------------------------------- update coupon ----------------------------

  async update(id, data) {
    if (data.couponcode) {
      data.couponcode = data.couponcode.trim().toUpperCase();
      const existing = await Coupon.findOne({
        couponcode: data.couponcode,
        _id: { $ne: id },
        isDeleted: false,
      });
      if (existing) {
        throw new ApiError(409, `Coupon with code "${data.couponcode}" already exists`);
      }
    }

    const coupon = await Coupon.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
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
      { new: true }
    );

    if (!coupon) {
      throw new ApiError(404, 'Coupon not found');
    }

    return { message: 'Coupon deleted successfully', id };
  }
}

module.exports = new CouponService();
