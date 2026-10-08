const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const metalPuritySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide metal purity name'],
      unique: true,
      trim: true,
      index: true,
    },
    metalType: {
      type: String,
      enum: ['Gold', 'Platinum', 'Silver'],
      default: 'Gold',
      required: true,
      index: true,
    },
    karat: {
      type: Number,
      default: 0,
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

metalPuritySchema.index({ metalType: 1, status: 1, isDeleted: 1 });

metalPuritySchema.plugin(metaPlugin);

module.exports = mongoose.model('MetalPurity', metalPuritySchema);
