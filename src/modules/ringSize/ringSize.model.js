const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const ringSizeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide ring size name'],
      unique: true,
      trim: true,
      index: true,
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

ringSizeSchema.index({ status: 1, isDeleted: 1 });

ringSizeSchema.plugin(metaPlugin);

module.exports = mongoose.model('RingSize', ringSizeSchema);
