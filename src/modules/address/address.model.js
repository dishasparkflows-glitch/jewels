const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const addressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    addressType: {
      type: String,
      enum: ['home', 'office'],
      default: 'home',
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    addressLine: {
      type: String,
      required: [true, 'Address line is required'],
      trim: true,
    },
    street: {
      type: String,
      default: '',
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
    },
    pincode: {
      type: String,
      required: [true, 'Pincode is required'],
      trim: true,
    },
    country: {
      type: String,
      default: 'India',
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isBillingDefault: {
      type: Boolean,
      default: false,
    },
    isShippingDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for fast lookup
addressSchema.index({ userId: 1, isDefault: -1 });
addressSchema.index({ userId: 1, addressType: 1 });
addressSchema.index({ userId: 1, isShippingDefault: -1 });
addressSchema.index({ userId: 1, isBillingDefault: -1 });

addressSchema.plugin(metaPlugin);

module.exports = mongoose.model('Address', addressSchema);
