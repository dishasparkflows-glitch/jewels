const mongoose = require('mongoose');

const currencySchema = new mongoose.Schema(
  {
    currencyInfo: {
      code: {
        type: String,
        required: [true, 'Please add a currency code'],
        uppercase: true,
        trim: true,
        maxlength: 10,
      },

      name: {
        type: String,
        required: [true, 'Please add a currency name'],
        trim: true,
      },

      symbol: {
        type: String,
        required: [true, 'Please add a currency symbol'],
        trim: true,
      },

      countryCode: {
        type: String,
        uppercase: true,
        trim: true,
        default: '',
      },
    },

    exchangeRate: {
      baseCurrency: {
        type: String,
        default: 'INR',
        uppercase: true,
        trim: true,
      },

      rate: {
        type: Number,
        required: true,
        default: 1,
      },

      inrRate: {
        type: Number,
        required: true,
        default: 1,
      },

      lastFetchedAt: {
        type: Date,
        default: null,
      },
    },

    settings: {
      isBaseCurrency: {
        type: Boolean,
        default: false,
      },

      useLiveRate: {
        type: Boolean,
        default: true,
      },

      isActive: {
        type: Boolean,
        default: true,
      },

      sortOrder: {
        type: Number,
        default: 0,
      },
    },

    metadata: {
      isDeleted: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Currency code must be unique across all documents,
// including soft-deleted currencies.
currencySchema.index(
  { 'currencyInfo.code': 1 },
  { unique: true }
);

currencySchema.index({
  'settings.isActive': 1,
  'metadata.isDeleted': 1,
});

module.exports = mongoose.model('Currency', currencySchema);
