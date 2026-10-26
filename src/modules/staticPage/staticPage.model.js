const mongoose = require('mongoose');

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
    seoTitle: {
      type: String,
      trim: true,
      default: '',
    },
    metaDescription: {
      type: String,
      trim: true,
      default: '',
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
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual to check if page is published/active
staticPageSchema.virtual('isPublished').get(function () {
  return this.status === 'published' || this.status === 'active';
});

const StaticPage = mongoose.model('StaticPage', staticPageSchema);

module.exports = StaticPage;
