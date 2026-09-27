const mongoose = require('mongoose');

const diamondCutSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide diamond cut name'],
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

diamondCutSchema.index({ status: 1, isDeleted: 1 });

module.exports = mongoose.model('DiamondCut', diamondCutSchema);
