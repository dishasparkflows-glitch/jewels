const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const diamondCutSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide diamond cut name'],
      unique: true,
      trim: true,
      index: true,
    },
    image: {
      url: String,
      public_id: String,
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
    collection: 'diamond_cuts',
  }
);

diamondCutSchema.index({ status: 1, isDeleted: 1 });

diamondCutSchema.plugin(metaPlugin);

module.exports = mongoose.model('DiamondCut', diamondCutSchema, 'diamond_cuts');

