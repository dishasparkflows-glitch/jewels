const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const homeSectionItemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      default: '',
    },
    subtitle: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    image: require('../../utils/mediaField'),
    linkUrl: {
      type: String,
      trim: true,
      default: '',
    },
    badge: {
      type: String,
      trim: true,
      default: '',
    },
    buttonText: {
      type: String,
      trim: true,
      default: '',
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    sku: {
      type: String,
      trim: true,
      default: '',
    },
    price: {
      type: Number,
      default: 0,
    },
    productType: {
      type: String,
      trim: true,
      default: '',
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    order: {
      type: Number,
      default: 0,
    },
    rating: {
      type: Number,
      default: 5,
    },
    authorName: {
      type: String,
      trim: true,
      default: '',
    },
    authorLocation: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: true }
);

const homeSectionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide home section title'],
      trim: true,
      index: true,
    },
    subtitle: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    sectionKey: {
      type: String,
      required: [true, 'Please provide section identifier key'],
      trim: true,
      lowercase: true,
      index: true,
    },
    sectionType: {
      type: String,
      enum: [
        'hero_slider',
        'category_grid',
        'banner_grid',
        'product_carousel',
        'promo_banner',
        'trust_badges',
        'testimonials',
        'instagram_feed',
        'appointment_banner',
        'custom_content',
      ],
      default: 'custom_content',
      index: true,
    },
    placement: {
      type: String,
      enum: ['home_top', 'home_middle', 'home_bottom', 'all'],
      default: 'home_middle',
      index: true,
    },
    badgeText: {
      type: String,
      trim: true,
      default: '',
    },
    buttonText: {
      type: String,
      trim: true,
      default: '',
    },
    buttonLink: {
      type: String,
      trim: true,
      default: '',
    },
    image: {
      url: { type: String, default: '' },
      key: { type: String, default: '' },
    },
    mobileImage: {
      url: { type: String, default: '' },
      key: { type: String, default: '' },
    },
    items: [homeSectionItemSchema],
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    visibility: {
      website: { type: Boolean, default: true },
      mobileApp: { type: Boolean, default: true },
    },
    settings: {
      backgroundColor: { type: String, default: '' },
      textColor: { type: String, default: '' },
      columns: { type: Number, default: 4 },
      autoplay: { type: Boolean, default: true },
      autoplaySpeed: { type: Number, default: 5000 },
      fullWidth: { type: Boolean, default: false },
    },
  },
  {
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

homeSectionSchema.plugin(metaPlugin);

module.exports = mongoose.model('HomeSection', homeSectionSchema, 'home_sections');
