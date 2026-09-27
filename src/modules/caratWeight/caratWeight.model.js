const mongoose = require('mongoose');

const caratWeightSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide carat weight name'],
      unique: true,
      trim: true,
      index: true,
    },
    weight: {
      type: Number,
      default: 0,
    },
    image: {
      url: { type: String, default: '' },
      public_id: { type: String, default: '' },
    },
    order: {
      type: Number,
      default: 0,
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
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

caratWeightSchema.index({ status: 1, isDeleted: 1 });

module.exports = mongoose.model('CaratWeight', caratWeightSchema);
