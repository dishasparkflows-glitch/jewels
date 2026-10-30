const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const blogCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a blog category name'],
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
      trim: true,
      default: '',
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
    },
  },
  {
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

blogCategorySchema.index({ 'meta.createdAt': -1 });

blogCategorySchema.pre('save', function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

blogCategorySchema.plugin(metaPlugin);

module.exports = mongoose.model('BlogCategory', blogCategorySchema, 'blog_categories');
