const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const sizeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide size name'],
      trim: true,
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      index: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      index: true,
    },
    subTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    subType: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
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
  }
);

sizeSchema.pre('validate', function (next) {
  if (!this.categoryId && this.category) this.categoryId = this.category;
  if (!this.category && this.categoryId) this.category = this.categoryId;
  if (!this.subTypeId && this.subType) this.subTypeId = this.subType;
  if (!this.subType && this.subTypeId) this.subType = this.subTypeId;
  if (!this.categoryId && !this.category) {
    return next(new Error('Please select a category for this size'));
  }
  next();
});

sizeSchema.index({ category: 1, subType: 1, status: 1, isDeleted: 1 });
sizeSchema.index({ categoryId: 1, subTypeId: 1, status: 1, isDeleted: 1 });

sizeSchema.plugin(metaPlugin);

module.exports = mongoose.model('Size', sizeSchema);
