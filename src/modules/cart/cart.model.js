const mongoose = require('mongoose');

const resolveCartItemModel = function () {
  const type = String(this?.itemType || 'product').toLowerCase();
  return type === 'diamond' ? 'Diamond' : 'Product';
};

const cartItemSchema = new mongoose.Schema(
  {
    itemType: {
      type: String,
      enum: ['product', 'diamond'],
      default: 'product',
      required: true,
    },
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: resolveCartItemModel,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      default: 1,
    },
    selectedMetal: {
      type: String,
      default: '',
    },
    selectedSize: {
      type: String,
      default: '',
    },
    selectedAttributes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    totalItemPrice: {
      type: Number,
      default: 0,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    items: [cartItemSchema],
  },
  {
    versionKey: false,
  }
);

module.exports = mongoose.model('Cart', cartSchema);
