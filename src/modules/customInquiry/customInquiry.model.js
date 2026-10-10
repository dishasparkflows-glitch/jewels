const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const customInquirySchema = new mongoose.Schema(
  {
    // 1. Customer Details
    customer: {
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
      },
      phone: {
        countryCode: {
          type: String,
          default: '91',
        },
        number: {
          type: String,
          trim: true,
        },
      },
    },

    // 2. Jewellery Requirements
    requirements: {
      stoneType: {
        type: String,
        required: [true, 'Please provide a stone type'],
        trim: true,
      },
      jewelryTypes: [
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
      comments: {
        type: String,
        trim: true,
        default: '',
      },
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
    versionKey: false,
    collection: 'custom_inquiries',
  }
);

customInquirySchema.index({ 'customer.email': 1 });
customInquirySchema.index({ 'meta.createdAt': -1 });
customInquirySchema.index({ status: 1, 'meta.createdAt': -1 });

customInquirySchema.plugin(metaPlugin);

module.exports = mongoose.model('CustomInquiry', customInquirySchema, 'custom_inquiries');
