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

diamondClaritySchema.index({ status: 1, isDeleted: 1 });

diamondClaritySchema.plugin(metaPlugin);

module.exports = mongoose.model('DiamondClarity', diamondClaritySchema);
