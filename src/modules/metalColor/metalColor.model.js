const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const metalColorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide metal color name'],
      unique: true,
      trim: true,
      index: true,
    },
    colorCode: {
      type: String,
      trim: true,
      default: '',
    },
    colorCodeEnd: {
      type: String,
      trim: true,
      default: '',
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

metalColorSchema.index({ status: 1, isDeleted: 1 });

metalColorSchema.plugin(metaPlugin);

module.exports = mongoose.model('MetalColor', metalColorSchema);
