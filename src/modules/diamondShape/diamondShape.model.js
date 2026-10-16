const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const diamondShapeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide diamond shape name'],
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
    collection: 'diamond_shapes',
  }
);

diamondShapeSchema.plugin(metaPlugin);

module.exports = mongoose.model('DiamondShape', diamondShapeSchema, 'diamond_shapes');

