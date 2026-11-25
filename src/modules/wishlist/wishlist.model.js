const mongoose = require('mongoose');

const resolveWishlistItemModel = function () {
  const type = String(this?.itemType || 'product').toLowerCase();
  return type === 'diamond' ? 'Diamond' : 'Product';
};

const wishlistItemSchema = new mongoose.Schema(
  {
    itemType: {
      type: String,
      enum: ['product', 'diamond'],
      default: 'product',
      required: true,
    },
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: resolveWishlistItemModel,
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const wishlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true,
      index: true,
    },
    items: [wishlistItemSchema],
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
);

module.exports = mongoose.model('Wishlist', wishlistSchema);
