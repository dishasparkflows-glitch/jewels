const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const settingSchema = new mongoose.Schema(
  {
    // Business & Identity
    companyName: {
      type: String,
      default: 'Neirah',
      trim: true,
    },
    emailAddress: {
      type: String,
      default: 'info@neirah.in',
      trim: true,
    },
    mobileNumber: {
      type: String,
      default: '+91 84600-91955',
      trim: true,
    },
    storeAddress: {
      type: String,
      default: 'Sanskrut - 1 GH Road G-1, 1/2 Sector 3D plot no.1182 G-1, near Hi-Tech hospital, Gandhinagar, Gujarat',
      trim: true,
    },
    gstCode: {
      type: String,
      default: '24AAAAA0000A1Z5',
      trim: true,
    },
    panCode: {
      type: String,
      default: 'ABCDE1234F',
      trim: true,
    },
    returnPeriodDays: {
      type: Number,
      default: 10,
    },
    returnPolicy: {
      type: String,
      default: 'Easy 15-Day Returns & Refund',
      trim: true,
    },
    shippingPolicy: {
      type: String,
      default: '',
      trim: true,
    },
    certificateImage: {
      url: { type: String, default: '' },
      public_id: { type: String, default: '' },
    },

    // Monetary Settlement
    bankName: {
      type: String,
      default: 'HDFC BANK',
      trim: true,
    },
    bankAccountNumber: {
      type: String,
      default: '50200012345678',
      trim: true,
    },
    ifscCode: {
      type: String,
      default: 'HDFC0000451',
      trim: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

settingSchema.plugin(metaPlugin);

module.exports = mongoose.model('Setting', settingSchema);
