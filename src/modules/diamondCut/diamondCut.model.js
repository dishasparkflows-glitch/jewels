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
      key: String,
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
    collection: 'diamond_cuts',
  }
);

diamondCutSchema.plugin(metaPlugin);

module.exports = mongoose.model('DiamondCut', diamondCutSchema, 'diamond_cuts');

