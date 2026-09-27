const mongoose = require('mongoose');

const diamondSizeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide diamond size name'],
      unique: true,
      trim: true,
      index: true,
    },
    sizeFrom: {
      type: Number,
      required: [true, 'Please provide size from'],
      min: [0, 'sizeFrom cannot be negative'],
    },
    sizeTo: {
      type: Number,
      required: [true, 'Please provide size to'],
      min: [0, 'sizeTo cannot be negative'],
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
    timestamps: true,
  }
);

diamondSizeSchema.index({ status: 1, isDeleted: 1 });
diamondSizeSchema.index({ sizeFrom: 1, sizeTo: 1 });

module.exports = mongoose.model('DiamondSize', diamondSizeSchema);
