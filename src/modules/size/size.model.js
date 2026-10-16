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
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Please select a category for this size'],
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
  },
  {
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

sizeSchema.index({ categoryId: 1, status: 1 });

sizeSchema.plugin(metaPlugin);

module.exports = mongoose.model('Size', sizeSchema);
