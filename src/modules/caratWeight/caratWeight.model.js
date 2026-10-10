const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const caratWeightSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide carat weight name'],
      unique: true,
      trim: true,
      index: true,
    },
    weight: {
      type: Number,
      default: 0,
    },
    image: {
      url: { type: String, default: '' },
      public_id: { type: String, default: '' },
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
    collection: 'carat_weights',
  }
);

caratWeightSchema.index({ status: 1, isDeleted: 1 });

caratWeightSchema.plugin(metaPlugin);

module.exports = mongoose.model('CaratWeight', caratWeightSchema, 'carat_weights');
