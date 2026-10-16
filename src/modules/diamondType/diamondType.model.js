const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const diamondTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide diamond type name'],
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
    collection: 'diamond_types',
  }
);

diamondTypeSchema.plugin(metaPlugin);

module.exports = mongoose.model('DiamondType', diamondTypeSchema, 'diamond_types');

