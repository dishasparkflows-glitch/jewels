const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const basicInfoSchema = new mongoose.Schema({
  title: { type: String, trim: true, default: '' },
  sku: { type: String, trim: true, default: '' },
  slug: { type: String, trim: true, default: '' },
  description: { type: String, default: '' },
  remark: { type: String, default: '', trim: true },
  productType: {
    type: String,
    enum: ['gold', 'silver', 'ornate'],
  },
  isOrnate: { type: Boolean, default: false },
}, { _id: false });

const pricingSchema = new mongoose.Schema({
  mrp: { type: Number, default: 0 },
  salePrice: { type: Number, default: 0 },
  costPrice: { type: Number, default: 0 },
  ornatePrice: { type: Number, default: 0 },
  gstPercentage: { type: Number },
  markupPercentage: { type: Number, default: 0 },
  mrpMarkupPercentage: { type: Number, default: 0 },
}, { _id: false });

const specificationsSchema = new mongoose.Schema({
  metalWeight: { type: Number, default: 0 },
}, { _id: false });

const ornateSchema = new mongoose.Schema({
  tagNo: { type: String, default: '' },
  barcode: { type: String, default: '' },
  itemCode: { type: String, default: '' },
  customGroupName: { type: String, default: '' },
  companyCode: { type: String, default: '' },
  carat: { type: String, default: '' },
  groupName: { type: String, default: '' },
  metalName: { type: String, default: '' },
  remark: { type: String, default: '' },
  ornateImages: [{
    url: String,
    key: String,
    mediaType: { type: String, default: 'image' },
  }],
  goldAmt: { type: Number, default: 0 },
  labourAmt: { type: Number, default: 0 },
  diamondAmt: { type: Number, default: 0 },
  stockQty: { type: Number, default: 0 },
  isSold: { type: Boolean, default: false },
}, { _id: false });

const productSchema = new mongoose.Schema(
  {
    // ── Structured Product Blocks ─────────────────────────────
    basicInfo: {
      type: basicInfoSchema,
      default: () => ({}),
    },
    pricing: {
      type: pricingSchema,
      default: () => ({}),
    },
    specifications: {
      type: specificationsSchema,
      default: () => ({}),
    },
    ornate: {
      type: ornateSchema,
      default: () => ({}),
    },
    productType: {
      type: String,
      enum: ['gold', 'silver', 'jewelry', 'standard', 'ornate'],
      index: true,
    },
    // Flag to distinguish ornate products in single collection
    isOrnate: {
      type: Boolean,
      default: false,
      index: true,
    },
    gstPercentage: {
      type: Number,
    },
    baseMetalWeight: {
      type: Number,
      default: 0,
    },
    baseLabourCharge: {
      type: Number,
      default: 0,
    },
    certificateCharge: {
      type: Number,
      default: 0,
    },
    otherAmountPercentage: {
      type: Number,
      default: 0,
    },


    categoryIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    }],
    featuredIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Featured',
    }],
    menuItemIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
    }],
    sizeIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Size',
    }],
    metalColorIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MetalColor',
    }],

    // ── Media & Color Images ──────────────────────────────────
    colorImages: [{
      metalColorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MetalColor',
      },
      images: [{
        url: String,
        key: String,
        mediaType: { type: String, default: 'image' },
      }],
      vtoImage: {
        url: String,
        key: String,
      },
      variantIcon: {
        url: String,
        key: String,
      },
      vtoCategory: {
        type: String,
        enum: ['hand', 'neck', 'ear', 'wrist', 'none'],
        default: 'none',
      },
      vtoConfig: {
        top: { type: Number, default: 50 },
        left: { type: Number, default: 50 },
        scale: { type: Number, default: 100 },
        clipBottom: { type: Number, default: 0 },
        rotation: { type: Number, default: 0 },
      },
    }],

    // General product images
    images: [{
      url: String,
      key: String,
      mediaType: { type: String, default: 'image' },
    }],

    // ── Diamond Configurations ────────────────────────────────
    centerDiamondRows: [{
      diamondTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondType' },
      diamondShapeId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondShape' },
      diamondColorId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondColor' },
      diamondClarityId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondClarity' },
      caratWeight: Number,
      pricePerCarat: Number,
    }],
    sideDiamondRows: [{
      diamondTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondType' },
      diamondShapeId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondShape' },
      diamondColorId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondColor' },
      diamondClarityId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondClarity' },
      sizeFrom: Number,
      sizeTo: Number,
      pieces: Number,
      caratWeight: Number,
      priceINR: Number,
    }],

    // ── Product Variants ──────────────────────────────────────
    variants: [{
      combination: String,
      sku: String,
      price: Number,
      stock: Number,
      metalPurityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MetalPurity',
      },
      diamondTypeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DiamondType',
      },
      diamondShapeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DiamondShape',
      },
      metalWeight: { type: Number, default: 0 },
      labourCharge: { type: Number, default: 0 },
      isCalculated: { type: Boolean, default: false },
      sideDiamondCost: Number,
      sideDiamondWeight: Number,
      centerDiamondCost: Number,
      centerDiamondWeight: Number,
      centerDiamondRate: Number,
      metalCost: Number,
      metalRate: Number,
      diamondCost: Number,
      computedMakingCharge: Number,
      computedGst: Number,
      diamondClarityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DiamondClarity',
      },
      diamondColorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DiamondColor',
      },
      sizeFrom: Number,
      sizeTo: Number,
      caratWeight: { type: Number, default: 0 },
      otherAmount: { type: Number, default: 0 },
    }],

    // ── Ornate Tag/Identification & Notes ─────────────────────
    tagNo: { type: String, index: true },
    remark: { type: String, default: '', trim: true },

    // ── Status & Metadata ─────────────────────────────────────
    stockStatus: {
      type: String,
      enum: ['In Stock', 'Out of Stock', 'Made to Order'],
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'draft', 'approved'],
      index: true,
    },

    birthMonth: [{
      type: String,
      enum: [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
      ],
    }],
    promoBanner: [{
      type: String,
    }],
    gender: [{
      type: String,
      enum: ['Male', 'Female', 'Unisex', 'Kids'],
    }],
    seo: {
      metaTitle: { type: String, default: '' },
      metaDescription: { type: String, default: '' },
      keywords: { type: String, default: '' },
    },
    productSpecifications: [{
      key: String,
      value: String,
    }],
    descriptionSections: [{
      header: { type: String, trim: true, default: '' },
      description: { type: String, trim: true, default: '' },
    }],
  },
  {
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for high performance querying
productSchema.index({ 'basicInfo.title': 'text', sku: 'text', tagNo: 'text' });
productSchema.index({ status: 1, isOrnate: 1 });
productSchema.index({ categoryIds: 1, status: 1 });
productSchema.index({ 'pricing.salePrice': 1 });
productSchema.index({ 'meta.createdAt': -1 });

// Virtuals for legacy and convenience access
productSchema.virtual('price').get(function () {
  return this.pricing?.mrp ?? 0;
});
productSchema.virtual('salePrice').get(function () {
  return this.pricing?.salePrice ?? 0;
});
productSchema.virtual('costPrice').get(function () {
  return this.pricing?.costPrice ?? 0;
});
productSchema.virtual('displayPrice').get(function () {
  return this.pricing?.salePrice ?? this.pricing?.mrp ?? 0;
});
productSchema.virtual('slug').get(function () {
  return this.basicInfo?.slug ?? '';
});
productSchema.virtual('stockQty').get(function () {
  return this.ornate?.stockQty ?? 0;
});
productSchema.virtual('ornateImages').get(function () {
  return this.ornate?.ornateImages ?? [];
});

// Virtual populates for singular/legacy relation fields
productSchema.virtual('category', {
  ref: 'Category',
  localField: 'categoryIds',
  foreignField: '_id',
});
productSchema.virtual('categoryId', {
  ref: 'Category',
  localField: 'categoryIds',
  foreignField: '_id',
});
productSchema.virtual('featured', {
  ref: 'Featured',
  localField: 'featuredIds',
  foreignField: '_id',
});
productSchema.virtual('featuredId', {
  ref: 'Featured',
  localField: 'featuredIds',
  foreignField: '_id',
});
productSchema.virtual('menuItem', {
  ref: 'MenuItem',
  localField: 'menuItemIds',
  foreignField: '_id',
});
productSchema.virtual('menuItemId', {
  ref: 'MenuItem',
  localField: 'menuItemIds',
  foreignField: '_id',
});
productSchema.virtual('size', {
  ref: 'Size',
  localField: 'sizeIds',
  foreignField: '_id',
});
productSchema.virtual('sizeId', {
  ref: 'Size',
  localField: 'sizeIds',
  foreignField: '_id',
});
productSchema.virtual('metalColors', {
  ref: 'MetalColor',
  localField: 'metalColorIds',
  foreignField: '_id',
});

productSchema.pre('save', function (next) {
  if (this.isOrnate && this.tagNo && !this.sku) {
    this.sku = this.tagNo;
  }
  if (this.isOrnate && !this.productType) {
    this.productType = 'ornate';
  } else if (this.productType === 'ornate') {
    this.isOrnate = true;
  }
  const activeTitle = this.basicInfo?.title || this.title;
  if (this.basicInfo && !this.basicInfo.slug && activeTitle) {
    this.basicInfo.slug = activeTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

productSchema.plugin(metaPlugin);

module.exports = mongoose.model('Product', productSchema);
