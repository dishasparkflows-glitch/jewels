const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a store name'],
      trim: true,
      index: true,
    },
    slug: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      lowercase: true,
      index: true,
    },
    contact: {
      _id: false,
      phone: {
        type: String,
        trim: true,
        default: '',
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        default: '',
      },
    },
    location: {
      _id: false,
      country: {
        type: String,
        trim: true,
        default: 'India',
        index: true,
      },
      state: {
        type: String,
        required: [true, 'Please provide a state'],
        trim: true,
        index: true,
      },
      city: {
        type: String,
        required: [true, 'Please provide a city'],
        trim: true,
        index: true,
      },
      area: {
        type: String,
        required: [true, 'Please provide an area or locality'],
        trim: true,
        index: true,
      },
      address: {
        _id: false,
        line1: {
          type: String,
          required: [true, 'Please provide address line 1'],
          trim: true,
        },
        line2: {
          type: String,
          trim: true,
          default: '',
        },
        landmark: {
          type: String,
          trim: true,
          default: '',
        },
        pincode: {
          type: String,
          trim: true,
          default: '',
        },
      },
      coordinates: {
        _id: false,
        latitude: {
          type: Number,
          default: null,
        },
        longitude: {
          type: Number,
          default: null,
        },
      },
      mapUrl: {
        type: String,
        trim: true,
        default: '',
      },
    },
    timings: {
      type: String,
      trim: true,
      default: '10:30 AM – 8:30 PM (Mon – Sun)',
    },
    image: {
      url: { type: String, default: '' },
      key: { type: String, default: '' },
    },
    stateIcon: {
      url: { type: String, default: '' },
      key: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
  },
  {
    versionKey: false,
  }
);

storeSchema.index({ 'location.state': 1, 'location.city': 1, 'location.area': 1, status: 1 });
storeSchema.index({ 'location.country': 1, 'location.state': 1, status: 1 });

module.exports = mongoose.model('Store', storeSchema);
