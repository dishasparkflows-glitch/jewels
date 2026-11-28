const mongoose = require('mongoose');

const seoSchema = new mongoose.Schema(
  {
    metaTitle: { type: String, trim: true, default: '' },
    metaDescription: { type: String, trim: true, default: '' },
    keywords: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const staticPageSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide a page title'],
      trim: true,
      index: true,
    },
    slug: {
      type: String,
      required: [true, 'Please provide a page slug'],
      trim: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['published', 'draft', 'active', 'inactive'],
      default: 'published',
      index: true,
    },
    seo: {
      type: seoSchema,
      default: () => ({}),
    },
    content: {
      type: String,
      default: '',
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    versionKey: false,
  }
);

const StaticPage = mongoose.model('StaticPage', staticPageSchema);

module.exports = StaticPage;
