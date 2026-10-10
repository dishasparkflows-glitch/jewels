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
      category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: [true, 'Please link a category to this banner'],
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
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual getters/setters for backward compatibility
bannerSchema
  .virtual('title')
  .get(function () {
    return this.content?.title || '';
  })
  .set(function (val) {
    if (!this.content) this.content = {};
    this.content.title = val;
  });

bannerSchema
  .virtual('subtitle')
  .get(function () {
    return this.content?.subtitle || '';
  })
  .set(function (val) {
    if (!this.content) this.content = {};
    this.content.subtitle = val;
  });

bannerSchema
  .virtual('description')
  .get(function () {
    return this.content?.description || '';
  })
  .set(function (val) {
    if (!this.content) this.content = {};
    this.content.description = val;
  });

bannerSchema
  .virtual('category')
  .get(function () {
    return this.display?.category;
  })
  .set(function (val) {
    if (!this.display) this.display = {};
    this.display.category = val;
  });

bannerSchema
  .virtual('type')
  .get(function () {
    return this.display?.type || 'herobanner';
  })
  .set(function (val) {
    if (!this.display) this.display = {};
    this.display.type = val;
  });

bannerSchema
  .virtual('position')
  .get(function () {
    return this.display?.position || 'none';
  })
  .set(function (val) {
    if (!this.display) this.display = {};
    this.display.position = val;
  });

bannerSchema
  .virtual('order')
  .get(function () {
    return this.display?.order ?? 0;
  })
  .set(function (val) {
    if (!this.display) this.display = {};
    this.display.order = val;
  });

bannerSchema.index({ 'display.type': 1, status: 1, isDeleted: 1 });
bannerSchema.index({ 'display.category': 1, status: 1 });
bannerSchema.index({ 'display.order': 1 });

bannerSchema.plugin(metaPlugin);

module.exports = mongoose.model('Banner', bannerSchema);
