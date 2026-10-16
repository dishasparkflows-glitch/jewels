const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const custJewelleryBeforAfterSchema = new mongoose.Schema(
  {
    beforeImage: {
      url: {
        type: String,
        required: true,
      },
      key: {
        type: String,
        required: true,
      },
    },
    afterImage: {
      url: {
        type: String,
        required: true,
      },
      key: {
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
  },
  {
    versionKey: false,
    collection: 'cust_jewellery_before_afters',
  }
);

custJewelleryBeforAfterSchema.plugin(metaPlugin);

module.exports = mongoose.model('CustJewelleryBeforAfter', custJewelleryBeforAfterSchema, 'cust_jewellery_before_afters');
