const mongoose = require('mongoose');

const diamondSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: [true, 'Please add a Diamond SKU'],
      unique: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Please add a Diamond title'],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Please add the Diamond price'],
      default: 0,
      min: [0, 'Price cannot be negative'],
    },
    rate: {
      type: Number,
      default: 0,
      min: [0, 'Rate cannot be negative'],
    },
    carat: {
      type: Number,
      required: [true, 'Please add Carat Weight'],
      min: [0, 'Carat cannot be negative'],
      index: true,
    },
    color: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DiamondColor',
      required: [true, 'Please select Diamond Color'],
      index: true,
    },
    clarity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DiamondClarity',
      required: [true, 'Please select Diamond Clarity'],
      index: true,
    },
    shape: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DiamondShape',
      required: [true, 'Please select Diamond Shape'],
      index: true,
    },
    type: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DiamondType',
      required: [true, 'Please select Diamond Type (Lab/Natural)'],
      index: true,
    },
    image: {
      url: String,
      public_id: String,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strictPopulate: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

diamondSchema.index({ status: 1, isDeleted: 1 });
diamondSchema.index({ carat: 1, price: 1 });

module.exports = mongoose.model('Diamond', diamondSchema);
