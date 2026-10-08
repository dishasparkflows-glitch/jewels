const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const couponSchema = new mongoose.Schema(
  {
    couponcode: {
      type: String,
      required: [true, 'Please add a coupon code'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    discounttype: {
      type: String,
      enum: ['Percentage', 'Fixed'],
      default: 'Percentage',
    },
    discountvalue: {
      type: Number,
      required: [true, 'Please add a discount value'],
      min: [0, 'Discount value cannot be negative'],
    },
    minimumorderamount: {
      type: Number,
      default: 0,
      min: [0, 'Minimum order amount cannot be negative'],
    },
    startdate: {
      type: Date,
      default: null,
    },
    enddate: {
      type: Date,
      default: null,
    },
    usagelimit: {
      type: Number,
      default: null,
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    peruserlimit: {
      type: Number,
      default: 1,
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
couponSchema.index({ startdate: 1, enddate: 1 });

couponSchema.plugin(metaPlugin);

module.exports = mongoose.model('Coupon', couponSchema);
