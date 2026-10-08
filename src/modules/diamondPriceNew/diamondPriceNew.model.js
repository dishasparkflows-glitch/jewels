const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const sideDiamondSchema = new mongoose.Schema(
  {
    sizeFrom: { type: Number, required: true },
    sizeTo: { type: Number, required: true },
    priceUSD: { type: Number, default: 0 },
    priceINR: { type: Number, default: 0 },
  },
  {
    versionKey: false,
    _id: true,
  }
);

const diamondPriceNewSchema = new mongoose.Schema(
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

    // Center Diamond Price Info
    centerDiamond: {
      priceUSD: { type: Number, default: 0 },
      priceINR: { type: Number, default: 0 },
    },

    // Array of multiple Side Diamond Ranges and their prices
    sideDiamonds: [sideDiamondSchema],

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
    strictPopulate: false,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

diamondPriceNewSchema.index(
  { diamondTypeId: 1, diamondShapeId: 1, diamondClarityId: 1, diamondColorId: 1 },
  { unique: true }
);

diamondPriceNewSchema.plugin(metaPlugin);

module.exports = mongoose.model('DiamondPriceNew', diamondPriceNewSchema);
