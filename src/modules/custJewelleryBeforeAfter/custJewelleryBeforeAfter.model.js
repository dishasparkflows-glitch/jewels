const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const custJewelleryBeforAfterSchema = new mongoose.Schema(
  {
    beforeImage: {
      url: {
        type: String,
        required: true,
      },
      public_id: {
        type: String,
        required: true,
      },
    },
    afterImage: {
      url: {
        type: String,
        required: true,
      },
      public_id: {
        type: String,
        required: true,
      },
    },
    alt: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    position: {
      type: Number,
      default: 0,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

custJewelleryBeforAfterSchema.plugin(metaPlugin);

module.exports = mongoose.model('CustJewelleryBeforAfter', custJewelleryBeforAfterSchema);
