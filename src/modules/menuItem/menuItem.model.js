const mongoose = require('mongoose');

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
      key: String,
    },
    order: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
  },
  {
    versionKey: false,
    collection: 'menu_items',
  }
);

menuItemSchema.index({ menuSectionId: 1, status: 1 });


module.exports = mongoose.model('MenuItem', menuItemSchema, 'menu_items');
