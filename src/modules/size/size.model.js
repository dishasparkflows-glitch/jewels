const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const sizeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide size name'],
      trim: true,
      index: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Please select a category for this size'],
      index: true,
    },
    subType: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

sizeSchema.index({ category: 1, subType: 1, status: 1, isDeleted: 1 });

sizeSchema.plugin(metaPlugin);

module.exports = mongoose.model('Size', sizeSchema);
