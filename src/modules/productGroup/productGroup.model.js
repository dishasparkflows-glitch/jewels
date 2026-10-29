const mongoose = require('mongoose');


const productGroupSchema = new mongoose.Schema(
  {
    groupCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    groupName: {
      type: String,
      required: [true, 'Group name is required'],
      trim: true,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    productIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    primaryProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    representativeMode: {
      type: String,
      enum: ['auto', 'manual'],
      default: 'auto',
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
  },
  {
    collection: 'product_groups',
    versionKey: false,
    strictPopulate: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

productGroupSchema.index({ slug: 1 });
productGroupSchema.index({ productIds: 1 });
productGroupSchema.index({ primaryProductId: 1 });
productGroupSchema.index({ status: 1, 'meta.deletedAt': 1 });
productGroupSchema.index({ 'meta.createdAt': -1 });

productGroupSchema.pre('save', function (next) {
  if (!this.slug && this.groupName) {
    this.slug = this.groupName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

module.exports = mongoose.model('ProductGroup', productGroupSchema);
