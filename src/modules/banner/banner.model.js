const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const bannerSchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Please link a category to this banner'],
    },
    title: {
      type: String,
      trim: true,
      default: '',
    },
    subtitle: {
      type: String,
      trim: true,
      default: '',
    },
    link: {
      type: String,
      default: '',
    },
    image: {
      url: String,
      public_id: String,
    },
    video: {
      url: String,
      public_id: String,
    },
    mediaType: {
      type: String,
      enum: ['image', 'video'],
      default: 'image',
    },
    type: {
      type: String,
      enum: ['herobanner', 'collectionbanner'],
      default: 'herobanner',
      required: [true, 'Please specify the banner type'],
    },
    position: {
      type: String,
      default: 'none',
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
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

bannerSchema.index({ type: 1, status: 1, isDeleted: 1 });
bannerSchema.index({ category: 1, status: 1 });

bannerSchema.plugin(metaPlugin);

module.exports = mongoose.model('Banner', bannerSchema);
