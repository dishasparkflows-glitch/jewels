const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

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
    colorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DiamondColor',
      required: [true, 'Please select Diamond Color'],
      index: true,
    },
    clarityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DiamondClarity',
      required: [true, 'Please select Diamond Clarity'],
      index: true,
    },
    shapeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DiamondShape',
      required: [true, 'Please select Diamond Shape'],
      index: true,
    },
    typeId: {
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
    versionKey: false,
    strictPopulate: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

diamondSchema.index({ status: 1, isDeleted: 1 });
diamondSchema.index({ carat: 1, price: 1 });

diamondSchema.virtual('color').get(function () { return this.colorId; }).set(function (v) { this.colorId = v; });
diamondSchema.virtual('clarity').get(function () { return this.clarityId; }).set(function (v) { this.clarityId = v; });
diamondSchema.virtual('shape').get(function () { return this.shapeId; }).set(function (v) { this.shapeId = v; });
diamondSchema.virtual('type').get(function () { return this.typeId; }).set(function (v) { this.typeId = v; });

diamondSchema.pre('validate', function (next) {
  if (!this.colorId && this.color) this.colorId = this.color;
  if (!this.clarityId && this.clarity) this.clarityId = this.clarity;
  if (!this.shapeId && this.shape) this.shapeId = this.shape;
  if (!this.typeId && this.type) this.typeId = this.type;
  next();
});

diamondSchema.plugin(metaPlugin);

module.exports = mongoose.model('Diamond', diamondSchema);
