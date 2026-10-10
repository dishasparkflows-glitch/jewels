const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const menuItemSchema = new mongoose.Schema(
  {
    menuSectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuSection',
      required: [true, 'Please add a section ID'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Please add a menu item title'],
      trim: true,
      index: true,
    },
    icon: {
      url: String,
      public_id: String,
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
    collection: 'menu_items',
  }
);

menuItemSchema.index({ menuSectionId: 1, status: 1, isDeleted: 1 });

menuItemSchema.plugin(metaPlugin);

module.exports = mongoose.model('MenuItem', menuItemSchema, 'menu_items');
