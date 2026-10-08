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
  }
);

diamondShapeSchema.index({ status: 1, isDeleted: 1 });

diamondShapeSchema.plugin(metaPlugin);

module.exports = mongoose.model('DiamondShape', diamondShapeSchema);
