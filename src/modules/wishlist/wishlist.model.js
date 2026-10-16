const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const wishlistItemSchema = new mongoose.Schema(
  {
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
    image: require('../../utils/mediaField'),
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
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    items: [wishlistItemSchema],
  },
  {
    versionKey: false,
  }
);

wishlistSchema.plugin(metaPlugin);

module.exports = mongoose.model('Wishlist', wishlistSchema);
