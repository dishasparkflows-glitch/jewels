const mongoose = require('mongoose');

const homeSectionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide home section title'],
      trim: true,
      index: true,
    },
    subtitle: {
      type: String,
      trim: true,
      default: '',
    },
    slug: {
      type: String,
      required: [true, 'Please provide section slug'],
      trim: true,
      lowercase: true,
      index: true,
    },
    productIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    visibility: {
      website: { type: Boolean, default: true },
      mobileApp: { type: Boolean, default: true },
    },
  },
  {
    versionKey: false,
  }
);

module.exports = mongoose.model('HomeSection', homeSectionSchema, 'home_sections');
