const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const couponSchema = new mongoose.Schema(
  {
    // 1. Coupon Details
    coupon: {
      code: {
        type: String,
        required: [true, 'Please add a coupon code'],
        unique: true,
        trim: true,
        uppercase: true,
      },
      description: {
        type: String,
        trim: true,
        default: '',
      },
    },

    // 2. Discount Details
    discount: {
      type: {
        type: String,
        enum: ['Percentage', 'Fixed'],
        default: 'Percentage',
      },
      value: {
        type: Number,
        required: [true, 'Please add a discount value'],
        min: [0, 'Discount value cannot be negative'],
      },
      minimumOrderAmount: {
        type: Number,
        default: 0,
        min: [0, 'Minimum order amount cannot be negative'],
      },
    },

    // 3. Validity Period
    validity: {
      startDate: {
        type: Date,
        default: null,
      },
      endDate: {
        type: Date,
        default: null,
      },
    },

    // 4. Usage Limits
    usage: {
      usageLimit: {
        type: Number,
        default: null,
      },
      usedCount: {
        type: Number,
        default: 0,
      },
      perUserLimit: {
        type: Number,
        default: 1,
      },
    },

    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    versionKey: false,
  }
);

couponSchema.index({ status: 1, isDeleted: 1 });
couponSchema.index({ 'validity.startDate': 1, 'validity.endDate': 1 });
couponSchema.index({ status: 1, 'meta.createdAt': -1 });

couponSchema.plugin(metaPlugin);

module.exports = mongoose.model('Coupon', couponSchema);
