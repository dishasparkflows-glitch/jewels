const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const gallerySchema = new mongoose.Schema(
  {
    themeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WebsiteTheme',
      default: null,
      index: true,
    },
    placement: {
      type: String,
      enum: [
        'herobanner',
        'collectionbanner',
        'categorybanner',
        'offerbanner',
        'celebrate',
        'mobileappbanner',
        'bookappointbanner',
        'customizebanner',
        'asset',
      ],
      default: 'herobanner',
      index: true,
    },
    platform: {
      type: String,
      enum: ['web', 'app', 'common'],
      default: 'common',
      index: true,
    },
    image: {
      _id: false,
      url: { type: String, required: true },
      key: { type: String, default: '' },
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
    collection: 'galleries',
  }
);

gallerySchema.plugin(metaPlugin);

module.exports = mongoose.model('Gallery', gallerySchema, 'galleries');
