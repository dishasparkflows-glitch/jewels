const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const settingSchema = new mongoose.Schema(
  {
    // Business & Identity
    companyName: {
      type: String,
      trim: true,
    },
    emailAddress: {
      type: String,
      trim: true,
    },
    mobileNumber: {
      type: String,
      trim: true,
    },
    storeAddress: {
      type: String,
      trim: true,
    },
    gstCode: {
      type: String,
      trim: true,
    },
    panCode: {
      type: String,
      trim: true,
    },
    returnPeriodDays: {
      type: Number,
    },
    returnPolicy: {
      type: String,
      trim: true,
    },
    shippingPolicy: {
      type: String,
      default: '',
      trim: true,
    },
    logoImage: {
      url: { type: String, default: '' },
      key: { type: String, default: '' },
    },
    mobileLogoImage: {
      url: { type: String, default: '' },
      key: { type: String, default: '' },
    },
    certificateImage: {
      url: { type: String, default: '' },
      key: { type: String, default: '' },
    },
    trustBadges: [{
      title: { type: String, trim: true, default: '' },
      image: {
        url: { type: String, trim: true, default: '' },
        key: { type: String, trim: true, default: '' },
      },
      order: { type: Number, default: 0 },
    }],

    // Monetary Settlement
    bankName: {
      type: String,
      trim: true,
    },
    bankAccountNumber: {
      type: String,
      trim: true,
    },
    ifscCode: {
      type: String,
      trim: true,
    },

  },
  {
    versionKey: false,
  }
);

settingSchema.plugin(metaPlugin);

module.exports = mongoose.model('Setting', settingSchema);
