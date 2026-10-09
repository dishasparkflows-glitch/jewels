const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const reviewSchema = new mongoose.Schema(
  {
    // 1. Customer Details
    customer: {
      name: {
        type: String,
        required: [true, 'Please provide customer name'],
        trim: true,
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        default: '',
      },
    },

    // 2. Review Details
    review: {
      title: {
        type: String,
        trim: true,
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
      reviewDate: {
        type: Date,
        default: Date.now,
      },
    },

    image: {
      url: {
        type: String,
        default: '',
      },
      key: {
        type: String,
        default: '',
      },
    },
    status: {
      type: String,
      enum: ['approved', 'pending', 'rejected'],
      default: 'approved',
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
  }
);

reviewSchema.index({ status: 1, 'meta.createdAt': -1 });
reviewSchema.index({ 'customer.email': 1 });
reviewSchema.index({ 'review.reviewDate': -1 });

reviewSchema.plugin(metaPlugin);

module.exports = mongoose.model('Review', reviewSchema);
