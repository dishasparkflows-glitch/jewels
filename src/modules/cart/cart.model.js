const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
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
      required: true,
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
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      default: 1,
    },
    selectedMetal: {
      type: String,
      default: '18K Yellow Gold',
    },
    selectedSize: {
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

const cartSchema = new mongoose.Schema(
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
    items: [cartItemSchema],
  },
  {
    timestamps: true,
  }
);

cartSchema.index({ user: 1, sessionId: 1 });

module.exports = mongoose.model('Cart', cartSchema);
