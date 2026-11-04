const mongoose = require('mongoose');

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
        required: [true, 'Please specify the showcase type (Celebrate or Gifts)'],
      },
      platform: {
        type: String,
        enum: ['web', 'mobile', 'common'],
        default: 'web',
      },
      order: {
        type: Number,
        default: 0,
      },
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

featuredSchema.index({ 'display.type': 1, status: 1 });
featuredSchema.index({ 'display.type': 1, 'display.order': 1 });

module.exports = mongoose.model('Featured', featuredSchema);
