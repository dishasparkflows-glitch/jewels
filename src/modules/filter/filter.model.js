const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

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
    defaultValue: {
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
    description: {
      type: String,
      trim: true,
      default: '',
    },
    defaultValue: {
      type: String,
      trim: true,
      default: '',
    },
    order: {
      type: Number,
      default: 0,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    // Category-wise overrides for enabled/disabled, order, custom title and default value
    categoryConfigs: [categoryConfigSchema],
  },
  {
    versionKey: false,
    collection: 'filters',
  }
);

filterSchema.plugin(metaPlugin);

module.exports = mongoose.model('Filter', filterSchema, 'filters');

