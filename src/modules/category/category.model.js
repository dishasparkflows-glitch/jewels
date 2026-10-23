const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');


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
    url: {
      type: String,
      trim: true,
      default: '',
    },
    link: {
      type: String,
      trim: true,
      default: '',
    },
    subtitle: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
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
      url: String,
      key: String,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    promoBanners: [promoBannerSchema],
  },
  {
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
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

categorySchema.plugin(metaPlugin);

module.exports = mongoose.model('Category', categorySchema);
