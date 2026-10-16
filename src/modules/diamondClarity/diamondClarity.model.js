const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const diamondClaritySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide diamond clarity name'],
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
    collection: 'diamond_clarities',
  }
);

diamondClaritySchema.plugin(metaPlugin);

module.exports = mongoose.model('DiamondClarity', diamondClaritySchema, 'diamond_clarities');

