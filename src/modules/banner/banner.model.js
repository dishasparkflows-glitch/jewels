const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const bannerSchema = new mongoose.Schema(
  {
    content: {
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
      description: {
        type: String,
        trim: true,
        default: '',
      },
    },
    display: {
      categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: false,
      },
      menuItemIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MenuItem',
      }],
      collectionGroup: {
        type: String,
        enum: ['gold', 'silver', 'spiritual'],
        default: null,
      },
      type: {
        type: String,
        enum: [
          'herobanner',
          'collectionbanner',
          'categorybanner',
          'offerbanner',
          'websitebanner',
          'mobileappbanner',
          'bookappointbanner',
        ],
        default: 'herobanner',
        required: [true, 'Please specify the banner type'],
      },
      platform: {
        type: String,
        enum: ['web', 'mobile'],
        default: 'web',
        index: true,
      },
      position: {
        type: String,
        default: 'none',
      },
      order: {
        type: Number,
        default: 0,
      },
      bannerKey: {
        type: String,
        default: 'custom_jewellery',
      },
    },
    link: {
      type: String,
      default: '',
    },
    appStoreUrl: {
      type: String,
      default: '',
    },
    googlePlayUrl: {
      type: String,
      default: '',
    },
    image: {
      url: String,
      key: String,
    },
    collectionImages: [{
      categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
      url: { type: String, required: true },
      key: { type: String, default: '' },
    }],
    video: {
      url: String,
      key: String,
    },
    mediaType: {
      type: String,
      enum: ['image', 'video'],
      default: 'image',
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

bannerSchema.index({ 'display.type': 1, status: 1 });
bannerSchema.index({ 'display.categoryId': 1, status: 1 });
bannerSchema.index({ 'display.order': 1 });

bannerSchema.plugin(metaPlugin);

module.exports = mongoose.model('Banner', bannerSchema);
