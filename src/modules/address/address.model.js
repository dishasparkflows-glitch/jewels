const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const addressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    address: {
      type: {
        type: String,
        enum: ['home', 'office', 'other'],
        default: 'home',
      },

      phone: String,

      addressLine: String,
      street: String,

      city: String,
      state: String,
      pincode: String,
      country: String,
    },

    defaults: {
      isDefault: {
        type: Boolean,
        default: false,
      },
      isBillingDefault: {
        type: Boolean,
        default: false,
      },
      isShippingDefault: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    versionKey: false,
  }
);

// Indexes for fast lookup
addressSchema.index({ userId: 1, 'defaults.isDefault': -1 });
addressSchema.index({ userId: 1, 'defaults.isShippingDefault': -1 });
addressSchema.index({ userId: 1, 'defaults.isBillingDefault': -1 });

addressSchema.plugin(metaPlugin);

module.exports = mongoose.model('Address', addressSchema);
