const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const featuredSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide featured item name'],
      unique: true,
      trim: true,
      index: true,
    },
    placement: {
      type: String,
      enum: ['Celebrate', 'Gifts'],
      default: 'Celebrate',
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
    position: {
      type: String,
      default: 'none',
    },
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    productCount: {
      type: Number,
      default: 0,
    },
  },
  {
    versionKey: false,
  }
);

featuredSchema.index({ placement: 1, status: 1 });

featuredSchema.plugin(metaPlugin);

module.exports = mongoose.model('Featured', featuredSchema);
