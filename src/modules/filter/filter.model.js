const mongoose = require('mongoose');

const priceRangeOptionSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      trim: true,
      default: '',
    },
    min: {
      type: Number,
      default: null,
      min: 0,
    },
    max: {
      type: Number,
      default: null,
      min: 0,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
);

const categoryConfigSchema = new mongoose.Schema(
  {
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    categorySlug: {
      type: String,
      trim: true,
      default: '',
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    customTitle: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false }
);

const filterSchema = new mongoose.Schema(
  {
    filterId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['checkbox', 'range', 'radio', 'select'],
      default: 'checkbox',
    },
    order: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    // Category-wise overrides for enabled/disabled, order, custom title and default value
    categoryConfigs: [categoryConfigSchema],
    // Preset price brackets for range-type filters (e.g. price-range)
    priceRanges: {
      type: [priceRangeOptionSchema],
      default: undefined,
    },
  },
  {
    versionKey: false,
    collection: 'filters',
  }
);


module.exports = mongoose.model('Filter', filterSchema, 'filters');

