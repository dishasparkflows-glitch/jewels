const mongoose = require('mongoose');

const diamondShapeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide diamond shape name'],
      unique: true,
      trim: true,
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

diamondShapeSchema.index({ status: 1, isDeleted: 1 });

module.exports = mongoose.model('DiamondShape', diamondShapeSchema);
