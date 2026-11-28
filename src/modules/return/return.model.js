const mongoose = require('mongoose');

const returnItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    title: { type: String, required: true },
    sku: { type: String, default: '' },
    price: { type: Number, default: 0 },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    reason: { type: String, default: '' },
  },
  { _id: true }
);

const returnAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, default: '' },
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

const returnSchema = new mongoose.Schema(
  {
    returnNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      index: true,
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
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      countryCode: { type: String, default: '+91' },
    },
    pickupAddress: {
      type: returnAddressSchema,
      required: true,
    },
    items: {
      type: [returnItemSchema],
      default: [],
    },
    reason: {
      type: String,
      default: 'Exchange/Return requested by customer',
    },
    status: {
      type: String,
      enum: [
        'requested',
        'approved',
        'pickup_scheduled',
        'in_transit',
        'received',
        'inspected',
        'completed',
        'rejected',
        'cancelled',
      ],
      default: 'requested',
      index: true,
    },
    shiprocketReturnInfo: {
      shiprocketOrderId: { type: String, default: null },
      shiprocketShipmentId: { type: String, default: null },
      awbCode: { type: String, default: null, index: true },
      courierName: { type: String, default: null },
      courierId: { type: Number, default: null },
      labelUrl: { type: String, default: null },
      status: {
        type: String,
        enum: ['pending', 'scheduled', 'success', 'failed', 'cancelled'],
        default: 'pending',
      },
      lastError: { type: String, default: null },
      pickupScheduledDate: { type: Date, default: null },
    },
    refund: {
      amount: { type: Number, default: 0 },
      status: {
        type: String,
        enum: ['pending', 'approved', 'processed', 'failed', 'not_applicable'],
        default: 'pending',
      },
      mode: { type: String, default: 'original_source' },
      transactionId: { type: String, default: null },
      processedAt: { type: Date, default: null },
    },
    adminNotes: {
      type: String,
      default: '',
    },
  },
  {
    versionKey: false,
    collection: 'returns',
  }
);

/**
 * Generate sequential return numbers: RJ/RET-0001, RJ/RET-0002, etc.
 */
returnSchema.statics.generateReturnNumber = async function () {
  const lastReturn = await this.findOne({
    returnNumber: { $regex: /^RJ\/RET-(\d+)/i },
  })
    .sort({ _id: -1 })
    .select('returnNumber')
    .lean();

  let nextSeq = 1;
  if (lastReturn && lastReturn.returnNumber) {
    const match = lastReturn.returnNumber.match(/^RJ\/RET-(\d+)/i);
    if (match) {
      nextSeq = parseInt(match[1], 10) + 1;
    }
  } else {
    const count = await this.countDocuments();
    nextSeq = count + 1;
  }

  let candidate = `RJ/RET-${String(nextSeq).padStart(4, '0')}`;
  while (await this.exists({ returnNumber: candidate })) {
    nextSeq += 1;
    candidate = `RJ/RET-${String(nextSeq).padStart(4, '0')}`;
  }

  return candidate;
};

returnSchema.pre('validate', async function (next) {
  if (!this.returnNumber) {
    try {
      this.returnNumber = await this.constructor.generateReturnNumber();
    } catch (err) {
      return next(err);
    }
  }
  next();
});

module.exports = mongoose.model('Return', returnSchema);
