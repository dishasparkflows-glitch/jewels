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

diamondTypeSchema.index({ status: 1, isDeleted: 1 });

diamondTypeSchema.plugin(metaPlugin);

module.exports = mongoose.model('DiamondType', diamondTypeSchema);
