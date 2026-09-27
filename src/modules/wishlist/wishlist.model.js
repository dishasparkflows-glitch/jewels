const mongoose = require('mongoose');

const wishlistItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    productId: {
      type: String,
      required: [true, 'Product ID is required'],
      trim: true,
    },
    title: {
      type: String,
      trim: true,
      default: '',
    },
    price: {
      type: Number,
      default: 0,
    },
    originalPrice: {
      type: Number,
      default: null,
    },
    image: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      default: '',
    },
    slug: {
      type: String,
      default: '',
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    sessionId: {
      type: String,
      default: null,
      index: true,
    },
    items: [wishlistItemSchema],
  },
  {
    timestamps: true,
  }
);

// Indexes
wishlistSchema.index({ user: 1, sessionId: 1 });

module.exports = mongoose.model('Wishlist', wishlistSchema);
