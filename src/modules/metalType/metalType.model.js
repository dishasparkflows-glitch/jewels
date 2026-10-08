const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const metalTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide metal type name'],
      unique: true,
      trim: true,
      index: true,
    },
    karat: {
      type: Number,
      default: 0,
    },
    metalColor: {
      type: String,
      trim: true,
      default: '',
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

metalTypeSchema.index({ status: 1, isDeleted: 1 });

metalTypeSchema.plugin(metaPlugin);

module.exports = mongoose.model('MetalType', metalTypeSchema);
