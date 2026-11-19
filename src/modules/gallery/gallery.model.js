const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema(
  {
    themeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Theme',
      default: null,
      index: true,
    },
    linkedRecord: {
      module: {
        type: String,
        default: null,
        index: true,
      },
      recordId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        index: true,
      },
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
    meta: {
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
      deletedAt: { type: Date, default: null },
    },
  },
  {
    versionKey: false,
    collection: 'galleries',
  }
);

gallerySchema.index({ 'linkedRecord.module': 1, 'linkedRecord.recordId': 1 });

module.exports = mongoose.model('Gallery', gallerySchema, 'galleries');
