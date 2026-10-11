const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const addressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    addressType: {
      type: String,
      enum: ['home', 'office'],
      default: 'home',
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    addressLine: {
      type: String,
      required: [true, 'Address line is required'],
      trim: true,
    },
    street: {
      type: String,
      default: '',
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
    },
    pincode: {
      type: String,
      required: [true, 'Pincode is required'],
      trim: true,
    },
    country: {
      type: String,
      default: 'India',
      trim: true,
    },
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
  {
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual aliases for compatibility
addressSchema.virtual('zipCode')
  .get(function () { return this.pincode; })
  .set(function (val) { this.pincode = val; });

// Virtual title mapped to addressType ('Home' / 'Office')
addressSchema.virtual('title')
  .get(function () {
    return this.addressType === 'office' ? 'Office' : 'Home';
  })
  .set(function (val) {
    if (val && typeof val === 'string') {
      const lower = val.toLowerCase().trim();
      if (lower.includes('office') || lower.includes('work')) {
        this.addressType = 'office';
      } else if (lower.includes('home')) {
        this.addressType = 'home';
      }
    }
  });

// Synchronize street with addressLine if street not explicitly provided
addressSchema.pre('validate', function (next) {
  if (this.addressLine && !this.street) {
    this.street = this.addressLine;
  }
  if (this.street && !this.addressLine) {
    this.addressLine = this.street;
  }
  next();
});

// Indexes for fast lookup
addressSchema.index({ user: 1, isDefault: -1 });
addressSchema.index({ user: 1, addressType: 1 });
addressSchema.index({ user: 1, isShippingDefault: -1 });
addressSchema.index({ user: 1, isBillingDefault: -1 });

addressSchema.plugin(metaPlugin);

module.exports = mongoose.model('Address', addressSchema);
