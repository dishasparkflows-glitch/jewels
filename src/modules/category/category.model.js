const mongoose = require('mongoose');

const promoBannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      default: '',
    },
    image: {
      url: { type: String, trim: true, default: '' },
      key: { type: String, trim: true, default: '' },
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
);

const sizingConfigSchema = new mongoose.Schema(
  {
    isScalable: {
      type: Boolean,
      default: false,
    },
    sizeLabel: {
      type: String,
      trim: true,
      default: 'Size',
    },
    baseSize: {
      type: Number,
      default: 7.0,
    },
    stepSize: {
      type: Number,
      default: 1.0,
    },
    percentPerStep: {
      type: Number,
      default: 2.5,
    },
  },
  { _id: false }
);

const categorySchema = new mongoose.Schema(
  {
    themeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WebsiteTheme',
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Please add a category name'],
      trim: true,
      index: true,
    },
    slug: {
      type: String,
      trim: true,
      index: true,
    },
    images: [
      {
        url: String,
        key: String,
        title: String,
      },
    ],
    icon: {
      url: { type: String, trim: true, default: '' },
      key: { type: String, trim: true, default: '' },
    },
    banner: {
      url: { type: String, trim: true },
      key: { type: String, trim: true },
    },
    sizeChart: {
      url: { type: String, trim: true, default: '' },
      key: { type: String, trim: true, default: '' },
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    type: {
      type: String,
      trim: true,
      default: 'category',
    },
    sizingConfig: {
      type: sizingConfigSchema,
      default: () => ({
        isScalable: false,
        sizeLabel: 'Size',
        baseSize: 7.0,
        stepSize: 1.0,
        percentPerStep: 2.5,
      }),
    },
    promoBanners: [promoBannerSchema],
  },
  {
    versionKey: false,
  }
);

categorySchema.index({ 'meta.createdAt': -1 });

categorySchema.pre('save', function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  next();
});


module.exports = mongoose.model('Category', categorySchema);
