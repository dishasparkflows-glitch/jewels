const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const basicInfoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide a blog title'],
      trim: true,
      index: true,
    },
    slug: {
      type: String,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Please provide blog content'],
      default: '',
    },
    shortDescription: {
      type: String,
      trim: true,
      default: '',
    },
    readTime: {
      type: String,
      trim: true,
      default: '3 min read',
    },
    publishDate: {
      type: Date,
      default: Date.now,
    },
    author: {
      type: String,
      trim: true,
      default: 'Neirah Atelier',
    },
  },
  { _id: false }
);

const seoSchema = new mongoose.Schema(
  {
    metaTitle: {
      type: String,
      trim: true,
      default: '',
    },
    metaDescription: {
      type: String,
      trim: true,
      default: '',
    },
    metaKeywords: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  { _id: false }
);

const blogSchema = new mongoose.Schema(
  {
    basicInfo: {
      type: basicInfoSchema,
      required: true,
      default: () => ({}),
    },
    blogCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BlogCategory',
      required: [true, 'Please select a blog category'],
      index: true,
    },
    image: {
      url: { type: String, trim: true, default: '' },
      key: { type: String, trim: true, default: '' },
      alt: { type: String, trim: true, default: '' },
    },
    seo: {
      type: seoSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    showInHomepage: {
      type: Boolean,
      default: true,
    },
    views: {
      type: Number,
      default: 0,
    },
  },
  {
    versionKey: false,
    timestamps: false,
  }
);

blogSchema.index({ 'meta.createdAt': -1 });

blogSchema.plugin(metaPlugin);

module.exports = mongoose.model('Blog', blogSchema);
