const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const blogSchema = new mongoose.Schema(
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
      name: { type: String, trim: true, default: '' },
      size: { type: String, trim: true, default: '' },
    },
    readTime: {
      type: String,
      trim: true,
      default: '3 min read',
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
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
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
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
    allowComments: {
      type: Boolean,
      default: true,
    },
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

blogSchema.index({ 'meta.createdAt': -1 });

// Automatically compute slug, shortDescription, and readTime if omitted
blogSchema.pre('save', function (next) {
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // Auto-generate shortDescription from HTML description if empty
  if (!this.shortDescription && this.description) {
    const plainText = this.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    this.shortDescription = plainText.length > 160 ? plainText.substring(0, 157) + '...' : plainText;
  }

  // Auto-calculate read time if missing or blank
  if ((!this.readTime || !this.readTime.trim()) && this.description) {
    const plainText = this.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = plainText ? plainText.split(/\s+/).length : 0;
    const mins = Math.max(1, Math.ceil(words / 200));
    this.readTime = `${mins} min read`;
  }

  next();
});

blogSchema.plugin(metaPlugin);

module.exports = mongoose.model('Blog', blogSchema);
