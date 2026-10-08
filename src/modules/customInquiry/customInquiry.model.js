const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const customInquirySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide your name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide your email address'],
      trim: true,
      lowercase: true,
      index: true,
    },
    phoneNumberCountryCode: {
      type: String,
      default: '91',
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    stoneType: {
      type: String,
      required: [true, 'Please provide a stone type'],
      trim: true,
    },
    jewelryType: [
      {
        type: String,
        trim: true,
      },
    ],
    metalType: {
      type: String,
      required: [true, 'Please provide a metal type'],
      trim: true,
    },
    budget: {
      type: String,
      required: [true, 'Please provide a budget range'],
      trim: true,
    },
    comments: {
      type: String,
      trim: true,
      default: '',
    },
    referenceImages: [
      {
        url: String,
        public_id: String,
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
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

customInquirySchema.index({ createdAt: -1 });
customInquirySchema.index({ status: 1, createdAt: -1 });

customInquirySchema.plugin(metaPlugin);

module.exports = mongoose.model('CustomInquiry', customInquirySchema);
