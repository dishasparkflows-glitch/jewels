const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const reviewSchema = new mongoose.Schema(
  {
    clientName: {
      type: String,
      required: [true, 'Client name is required'],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: 1,
      max: 5,
      default: 5,
    },
    comment: {
      type: String,
      required: [true, 'Comment is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['approved', 'pending', 'rejected'],
      default: 'approved',
      index: true,
    },
    reviewDate: {
      type: Date,
      default: Date.now,
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
  }
);

reviewSchema.index({ status: 1, createdAt: -1 });

reviewSchema.plugin(metaPlugin);

module.exports = mongoose.model('Review', reviewSchema);
