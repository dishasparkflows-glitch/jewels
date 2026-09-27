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
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

menuItemSchema.index({ menuSectionId: 1, status: 1, isDeleted: 1 });

module.exports = mongoose.model('MenuItem', menuItemSchema);
