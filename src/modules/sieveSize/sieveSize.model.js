const mongoose = require('mongoose');

const sieveSizeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide sieve size name'],
      unique: true,
      trim: true,
      index: true,
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

sieveSizeSchema.index({ status: 1, isDeleted: 1 });

module.exports = mongoose.model('SieveSize', sieveSizeSchema);
