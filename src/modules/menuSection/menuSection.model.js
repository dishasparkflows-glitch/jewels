const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const menuSectionSchema = new mongoose.Schema(
  {
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Please add a category ID'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Please add a section title'],
      trim: true,
      index: true,
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
    collection: 'menu_sections',
  }
);

menuSectionSchema.index({ categoryId: 1, status: 1, isDeleted: 1 });

menuSectionSchema.plugin(metaPlugin);

module.exports = mongoose.model('MenuSection', menuSectionSchema, 'menu_sections');
