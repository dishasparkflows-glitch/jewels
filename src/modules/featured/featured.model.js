const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const featuredSchema = new mongoose.Schema(
  {
    themeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WebsiteTheme',
      default: null,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      default: '',
    },
    display: {
      _id: false,
      type: {
        type: String,
        enum: ['Celebrate', 'Gifts'],
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
    placement: {
      type: String,
      enum: ['Celebrate', 'Gifts'],
      default: 'Celebrate',
      index: true,
    },
    image: {
      url: String,
      key: String,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    position: {
      type: String,
      default: 'none',
    },
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    menuItemIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MenuItem',
      },
    ],
    productIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
  },
  {
    versionKey: false,
  }
);

featuredSchema.pre('validate', function () {
  if (!this.display) {
    this.display = {};
  }
  if (!this.display.type && this.placement) {
    this.display.type = this.placement;
  }
  if (this.display?.type && !this.placement) {
    this.placement = this.display.type;
  }
});

featuredSchema.index({ placement: 1, status: 1 });
featuredSchema.index({ 'display.type': 1, status: 1 });

featuredSchema.plugin(metaPlugin);

module.exports = mongoose.model('Featured', featuredSchema);
