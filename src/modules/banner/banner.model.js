const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema(
  {
    content: {
      _id: false,
      title: {
        type: String,
        trim: true,
      },
      subtitle: {
        type: String,
        trim: true,
      },
      description: {
        type: String,
        trim: true,
      },
    },
    display: {
      _id: false,
      categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: false,
      },
      menuItemIds: {
        type: [{
          type: mongoose.Schema.Types.ObjectId,
          ref: 'MenuItem',
        }],
        default: undefined,
      },
      collectionGroup: {
        type: String,
        enum: ['gold', 'silver', 'spiritual'],
      },
      type: {
        type: String,
        enum: [
          'herobanner',
          'collectionbanner',
          'categorybanner',
          'offerbanner',
          'customizebanner',
          'websitebanner',
          'mobileappbanner',
          'bookappointbanner',
        ],
        default: 'herobanner',
        required: [true, 'Please specify the banner type'],
      },
      platform: {
        type: String,
        enum: ['web', 'mobile', 'common'],
        default: 'web',
        index: true,
      },
      order: {
        type: Number,
        default: 0,
      },
    },
    appStoreUrl: {
      type: String,
      trim: true,
    },
    googlePlayUrl: {
      type: String,
      trim: true,
    },
    image: {
      _id: false,
      url: String,
      key: String,
      mediaType: {
        type: String,
        default: 'image',
      },
    },
    mobileImage: {
      _id: false,
      url: String,
      key: String,
      mediaType: {
        type: String,
        default: 'image',
      },
    },
    collectionImages: {
      type: [{
        _id: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
        categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
        url: { type: String, required: true },
        key: { type: String },
        order: { type: Number, default: 0 },
      }],
      default: undefined,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
  },
  {
    versionKey: false,
  }
);

bannerSchema.index({ 'display.type': 1, status: 1 });
bannerSchema.index({ 'display.categoryId': 1, status: 1 });
bannerSchema.index({ 'display.order': 1 });

module.exports = mongoose.model('Banner', bannerSchema);
