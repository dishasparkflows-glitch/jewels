const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const centerDiamondPriceSchema = new mongoose.Schema(
  {
    diamondTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DiamondType',
      required: true,
      index: true,
    },
    diamondShapeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DiamondShape',
      required: true,
      index: true,
    },
    diamondClarityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DiamondClarity',
      required: true,
      index: true,
    },
    diamondColorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DiamondColor',
      required: true,
      index: true,
    },
    priceUSD: {
      type: Number,
      default: 0,
    },
    priceINR: {
      type: Number,
      default: 0,
    },
    sizeFrom: {
      type: Number,
      default: 0,
    },
    sizeTo: {
      type: Number,
      default: 0,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    versionKey: false,
    strictPopulate: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

centerDiamondPriceSchema.index(
  {
    diamondTypeId: 1,
    diamondShapeId: 1,
    diamondClarityId: 1,
    diamondColorId: 1,
    sizeFrom: 1,
    sizeTo: 1,
  },
  { unique: true }
);

centerDiamondPriceSchema.plugin(metaPlugin);

module.exports = mongoose.model('CenterDiamondPrice', centerDiamondPriceSchema);
