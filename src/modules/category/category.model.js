const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const subTypeSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    code: { type: String, trim: true },
    sizeChart: {
      url: String,
      public_id: String,
    },
  },
  { _id: true }
);

const promoBannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      default: '',
    },
    image: {
      url: { type: String, trim: true, default: '' },
      public_id: { type: String, trim: true, default: '' },
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
        public_id: String,
        title: String,
      },
    ],
    icon: {
      url: { type: String, trim: true, default: '' },
      public_id: { type: String, trim: true, default: '' },
    },
    banner: {
      url: { type: String, trim: true, default: '' },
      public_id: { type: String, trim: true, default: '' },
    },
    sizeChart: {
      url: String,
      public_id: String,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    type: {
      type: String,
      enum: ['category', 'collection'],
      default: 'category',
      index: true,
    },
    subTypes: [subTypeSchema],
    promoBanner: [promoBannerSchema],
    promoBanners: [promoBannerSchema],
    prompbanners: [promoBannerSchema],
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

  // Sync promoBanner, promoBanners, and prompbanners
  const promos =
    (this.promoBanner && this.promoBanner.length > 0 && this.promoBanner) ||
    (this.promoBanners && this.promoBanners.length > 0 && this.promoBanners) ||
    (this.prompbanners && this.prompbanners.length > 0 && this.prompbanners) ||
    [];

  if (promos.length > 0) {
    if (!this.promoBanner || this.promoBanner.length === 0) this.promoBanner = promos;
    if (!this.promoBanners || this.promoBanners.length === 0) this.promoBanners = promos;
    if (!this.prompbanners || this.prompbanners.length === 0) this.prompbanners = promos;
  }

  next();
});

categorySchema.plugin(metaPlugin);

module.exports = mongoose.model('Category', categorySchema);
