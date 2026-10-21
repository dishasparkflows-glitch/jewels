const mongoose = require('mongoose');

const syncMetaSchema = new mongoose.Schema(
  {
    firstSyncedAt: { type: Date, default: null },
    firstSyncedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    firstSourceProductId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    firstProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    firstSyncedFields: [{ type: String }],
    lastSyncedAt: { type: Date, default: null },
    lastSyncedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastSyncOperationId: { type: mongoose.Schema.Types.ObjectId, default: null },
    syncVersion: { type: Number, default: 0 },
  },
  { _id: false }
);

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
    sync: {
      type: syncMetaSchema,
      default: () => ({
        firstSyncedAt: null,
        firstSyncedBy: null,
        firstSourceProductId: null,
        firstProductIds: [],
        firstSyncedFields: [],
        lastSyncedAt: null,
        lastSyncedBy: null,
        lastSyncOperationId: null,
        syncVersion: 0,
      }),
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
