const mongoose = require('mongoose');

const gemstoneTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide gemstone type name'],
      unique: true,
      trim: true,
      index: true,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    colorCode: {
      type: String,
      trim: true,
      default: '#9966CC',
    },
    colorCodeEnd: {
      type: String,
      trim: true,
    },
    swatchImage: {
      url: String,
      key: String,
    },
    image: {
      url: String,
      key: String,
    },
    birthstoneMonth: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
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
    collection: 'gemstone_types',
  }
);

gemstoneTypeSchema.pre('save', function (next) {
  if (this.name && !this.slug) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  if (!this.colorCodeEnd) {
    this.colorCodeEnd = this.colorCode;
  }
  next();
});

module.exports = mongoose.model('GemstoneType', gemstoneTypeSchema, 'gemstone_types');
