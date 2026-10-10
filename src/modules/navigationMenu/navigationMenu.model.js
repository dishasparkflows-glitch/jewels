const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const menuItemItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    linkType: {
      type: String,
      enum: ['Category', 'Custom Link', 'Collection', 'Page'],
      default: 'Category',
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    },
    url: { type: String, default: '' },
    icon: { type: String, default: '' },
    openInNewTab: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { _id: true }
);

const menuSectionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    icon: { type: String, default: 'star' },
    order: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    items: [menuItemItemSchema],
  },
  { _id: true }
);

const menuBannerSchema = new mongoose.Schema(
  {
    title: { type: String, default: '', trim: true },
    subtitle: { type: String, default: '', trim: true },
    image: {
      url: String,
      public_id: String,
    },
    linkType: {
      type: String,
      enum: ['Category', 'Custom Link', 'Collection', 'Page'],
      default: 'Category',
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    },
    categoryName: { type: String, default: '' },
    url: { type: String, default: '' },
    order: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { _id: true }
);

const navigationMenuSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a navigation menu title'],
      trim: true,
      index: true,
    },
    navType: {
      type: String,
      enum: ['main', 'footer', 'utility', 'settings'],
      default: 'main',
      index: true,
    },
    type: {
      type: String,
      enum: ['Category', 'Custom Link', 'Collection', 'Page'],
      default: 'Category',
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    },
    customUrl: {
      type: String,
      default: '',
    },
    openInNewTab: {
      type: Boolean,
      default: false,
    },
    isMegaMenu: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    icon: {
      url: String,
      public_id: String,
      name: String,
    },
    image: {
      url: String,
      public_id: String,
    },
    sections: [menuSectionSchema],
    banners: [menuBannerSchema],
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    collection: 'navigation_menus',
  }
);

navigationMenuSchema.index({ navType: 1, order: 1, isDeleted: 1 });
navigationMenuSchema.plugin(metaPlugin);

module.exports = mongoose.model('NavigationMenu', navigationMenuSchema, 'navigation_menus');
