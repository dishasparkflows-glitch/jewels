const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const bannerSchema = new mongoose.Schema(
  {
    themeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WebsiteTheme',
      index: true,
    },
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
      position: {
        type: String,
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
    media: {
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
        _id: false,
        categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
        url: { type: String, required: true },
        key: { type: String },
      }],
      default: undefined,
    },
    mediaType: {
      type: String,
      enum: ['image', 'video'],
      default: 'image',
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

// Pre-save cleanup to ensure no default '' or null values are stored
bannerSchema.pre('save', function (next) {
  ['themeId', 'targetAudience', 'appStoreUrl', 'googlePlayUrl', 'startDate', 'endDate'].forEach((field) => {
    if (this[field] === '' || this[field] === null) {
      this[field] = undefined;
    }
  });

  if (this.content) {
    ['title', 'subtitle', 'description'].forEach((field) => {
      if (this.content[field] === '' || this.content[field] === null) {
        this.content[field] = undefined;
      }
    });
    if (!this.content.title && !this.content.subtitle && !this.content.description) {
      this.content = undefined;
    }
  }

  if (this.display) {
    ['categoryId', 'collectionGroup', 'position'].forEach((field) => {
      if (this.display[field] === '' || this.display[field] === null) {
        this.display[field] = undefined;
      }
    });
    if (Array.isArray(this.display.menuItemIds) && this.display.menuItemIds.length === 0) {
      this.display.menuItemIds = undefined;
    }
  }

  // Unified media & image synchronization
  const incomingMedia = this.media || this.image;
  if (incomingMedia && incomingMedia.url) {
    const isVid = (incomingMedia.mediaType === 'video') || (this.mediaType === 'video') || /\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(incomingMedia.url);
    const mType = isVid ? 'video' : (incomingMedia.mediaType || this.mediaType || 'image');
    const unified = {
      url: incomingMedia.url,
      key: incomingMedia.key || undefined,
      mediaType: mType,
    };
    this.image = unified;
    this.media = unified;
    this.mediaType = mType;
  } else {
    this.image = undefined;
    this.media = undefined;
  }

  if (this.mobileImage) {
    if (!this.mobileImage.url) {
      this.mobileImage = undefined;
    } else {
      const isMobileVid = (this.mobileImage.mediaType === 'video') || /\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(this.mobileImage.url);
      this.mobileImage.mediaType = isMobileVid ? 'video' : (this.mobileImage.mediaType || 'image');
      if (this.mobileImage.key === '' || this.mobileImage.key === null) {
        this.mobileImage.key = undefined;
      }
    }
  }

  if (Array.isArray(this.collectionImages)) {
    if (this.collectionImages.length === 0) {
      this.collectionImages = undefined;
    } else {
      this.collectionImages.forEach((img) => {
        if (img.key === '' || img.key === null) img.key = undefined;
        if (img.categoryId === null) img.categoryId = undefined;
      });
    }
  }

  if (typeof next === 'function') next();
});

bannerSchema.index({ 'display.type': 1, status: 1 });
bannerSchema.index({ 'display.categoryId': 1, status: 1 });
bannerSchema.index({ 'display.order': 1 });

bannerSchema.plugin(metaPlugin);

module.exports = mongoose.model('Banner', bannerSchema);
