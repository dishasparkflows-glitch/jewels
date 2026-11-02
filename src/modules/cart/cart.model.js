const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const cartItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
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
    totalItemPrice: {
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
      _id: false,
      metalPurity: { type: mongoose.Schema.Types.ObjectId, ref: 'MetalPurity', default: null },
      metalColor: { type: mongoose.Schema.Types.ObjectId, ref: 'MetalColor', default: null },
      diamondType: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondType', default: null },
      diamondShape: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondShape', default: null },
      diamondClarity: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondClarity', default: null },
      diamondColor: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondColor', default: null },
      caratWeight: { type: Number, default: null },
      size: { type: mongoose.Schema.Types.ObjectId, ref: 'Size', default: null },
      sizeRange: { type: String, default: null },
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
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    items: [cartItemSchema],
  },
  {
    versionKey: false,
  }
);

cartSchema.plugin(metaPlugin);

module.exports = mongoose.model('Cart', cartSchema);
