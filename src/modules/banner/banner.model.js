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
        enum: ['web', 'mobile'],
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
    link: {
      type: String,
      trim: true,
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
    video: {
      _id: false,
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Pre-save cleanup to ensure no default '' or null values are stored
bannerSchema.pre('save', function (next) {
  ['themeId', 'link', 'appStoreUrl', 'googlePlayUrl', 'startDate', 'endDate'].forEach((field) => {
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

  if (this.image) {
    if (!this.image.url) {
      this.image = undefined;
    } else if (this.image.key === '' || this.image.key === null) {
      this.image.key = undefined;
    }
  }

  if (this.video) {
    if (!this.video.url) {
      this.video = undefined;
    } else if (this.video.key === '' || this.video.key === null) {
      this.video.key = undefined;
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
