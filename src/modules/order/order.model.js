const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');
const mediaField = require('../../utils/mediaField');

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    productId: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    totalItemPrice: {
      type: Number,
      default: 0,
    },
    originalPrice: {
      type: Number,
      default: null,
    },
    image: mediaField,
    category: {
      type: String,
      default: '',
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
      default: null,
    },
  },
  { _id: true }
);

const addressSnapshotSchema = new mongoose.Schema(
  {
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    fullName: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    countryCode: { type: String, default: '+91' },
    addressLine: { type: String, default: '' },
    apartment: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    postalCode: { type: String, default: '' },
    country: { type: String, default: 'India' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    customer: {
      firstName: { type: String, default: '' },
      lastName: { type: String, default: '' },
      email: { type: String, default: '', index: true },
      phone: { type: String, default: '', index: true },
    },
    shippingAddress: {
      type: addressSnapshotSchema,
      required: true,
    },
    billingAddress: {
      type: addressSnapshotSchema,
      default: null,
    },
    items: {
      type: [orderItemSchema],
      validate: [(val) => val && val.length > 0, 'Order must contain at least one item'],
    },
    pricing: {
      subtotal: { type: Number, required: true, default: 0 },
      shipping: { type: Number, required: true, default: 0 },
      tax: { type: Number, required: true, default: 0 },
      discount: { type: Number, default: 0 },
      total: { type: Number, required: true, default: 0 },
      codDueNow: { type: Number, default: 0 },
      codRemaining: { type: Number, default: 0 },
      paidAmount: { type: Number, default: 0 },
    },
    coupon: {
      code: { type: String, default: null },
      discountAmount: { type: Number, default: 0 },
      couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', default: null },
    },
    payment: {
      method: {
        type: String,
        enum: ['online', 'cod'],
        default: 'online',
      },
      provider: {
        type: String,
        enum: ['razorpay', 'ccavenue', 'cod'],
        default: 'razorpay',
      },
      status: {
        type: String,
        enum: ['pending', 'processing', 'paid', 'partially_paid', 'failed', 'refunded'],
        default: 'pending',
        index: true,
      },
      transactionId: { type: String, default: null, index: true },
      gatewayOrderId: { type: String, default: null, index: true },
      signature: { type: String, default: null },
      paymentMode: { type: String, default: null }, // e.g. 'UPI', 'NetBanking', 'Credit Card'
      paidAt: { type: Date, default: null },
      paymentDetails: { type: mongoose.Schema.Types.Mixed, default: null },
      failureReason: { type: String, default: null },
    },
    orderStatus: {
      type: String,
      enum: ['placed', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'],
      default: 'placed',
      index: true,
    },
    timeline: [
      {
        status: { type: String, required: true },
        message: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    notes: {
      type: String,
      default: '',
    },
    source: {
      type: String,
      default: 'storefront',
    },
  },
  {
    versionKey: false,
    collection: 'orders',
  }
);

orderSchema.plugin(metaPlugin);

module.exports = mongoose.model('Order', orderSchema);

