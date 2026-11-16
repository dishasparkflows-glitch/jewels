const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      default: '',
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
  { _id: true, skipMeta: true }
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
    userId: {
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
      countryCode: { type: String, default: '+91' },
    },
    shippingAddress: {
      type: addressSnapshotSchema,
      required: true,
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
      discountType: { type: String, enum: ['Percentage', 'Fixed', null], default: null },
      discountValue: { type: Number, default: 0 },
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
      enum: ['pending', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'],
      default: 'pending',
      index: true,
    },
    logisticsProvider: {
      type: String,
      enum: ['Shiprocket', 'Sequel', null],
      default: null,
    },
    shiprocketInfo: {
      status: {
        type: String,
        enum: ['not_started', 'creating', 'success', 'failed', 'cancelled'],
        default: 'not_started',
      },
      creatingSince: { type: Date, default: null },
      shiprocketOrderId: { type: String, default: null },
      shiprocketShipmentId: { type: String, default: null },
      awbCode: { type: String, default: null, index: true },
      courierName: { type: String, default: null },
      courierId: { type: Number, default: null },
      labelUrl: { type: String, default: null },
      manifestUrl: { type: String, default: null },
      pickupScheduledDate: { type: Date, default: null },
      lastError: { type: String, default: null },
    },
    shippedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    versionKey: false,
    collection: 'orders',
  }
);

/**
 * Generate formatted sequential order numbers: RJ/ORD-0001, RJ/ORD-0002, etc.
 */
orderSchema.statics.generateOrderNumber = async function () {
  const lastOrder = await this.findOne({
    orderNumber: { $regex: /^RJ\/ORD-(\d+)/i },
  })
    .sort({ _id: -1 })
    .select('orderNumber')
    .lean();

  let nextSeq = 1;
  if (lastOrder && lastOrder.orderNumber) {
    const match = lastOrder.orderNumber.match(/^RJ\/ORD-(\d+)/i);
    if (match) {
      nextSeq = parseInt(match[1], 10) + 1;
    }
  } else {
    // If no RJ/ORD- format exists yet, use existing orders count to continue sequence
    const count = await this.countDocuments();
    nextSeq = count + 1;
  }

  let candidate = `RJ/ORD-${String(nextSeq).padStart(4, '0')}`;
  while (await this.exists({ orderNumber: candidate })) {
    nextSeq += 1;
    candidate = `RJ/ORD-${String(nextSeq).padStart(4, '0')}`;
  }

  return candidate;
};

orderSchema.pre('validate', async function (next) {
  if (!this.orderNumber) {
    try {
      this.orderNumber = await this.constructor.generateOrderNumber();
    } catch (err) {
      return next(err);
    }
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);

