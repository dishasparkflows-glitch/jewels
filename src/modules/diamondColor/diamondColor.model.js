const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const diamondColorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide diamond color name'],
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
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

diamondColorSchema.index({ status: 1, isDeleted: 1 });

diamondColorSchema.plugin(metaPlugin);

module.exports = mongoose.model('DiamondColor', diamondColorSchema);
