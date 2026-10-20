const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const basicInfoSchema = new mongoose.Schema({
  title: { type: String, trim: true },
  sku: { type: String, trim: true },
  slug: { type: String, trim: true },
  description: { type: String },
  remark: { type: String, trim: true },
  productType: {
    type: String,
    enum: ['gold', 'silver', 'jewelry', 'standard', 'ornate'],
  },
  gender: {
    type: [{
      type: String,
      enum: ['Male', 'Female', 'Unisex', 'Kids'],
    }],
    default: undefined,
  },
  isOrnate: { type: Boolean, default: false },
}, { _id: false });

const pricingSchema = new mongoose.Schema({
  calculationMode: { type: String, enum: ['manual', 'automatic'], default: 'manual' },
  baseCarat: { type: Number, min: 0, default: 1 },
  gstPercentage: { type: Number, min: 0, default: 3 },
  mrp: { type: Number, default: 0 },
  salePrice: { type: Number, default: 0 },
  costPrice: { type: Number, default: 0 },
  ornatePrice: { type: Number, default: 0 },
  markupPercentage: { type: Number, default: 0 },
  mrpMarkupPercentage: { type: Number, default: 0 },
  calculatedPrice: { type: Number, default: 0 },
  baseLabourCharge: { type: Number, default: 0 },
  certificateCharge: { type: Number, default: 0 },
  otherAmountPercentage: { type: Number, default: 0 },
}, { _id: false });

const specificationsSchema = new mongoose.Schema({
  metalWeight: { type: Number },
}, { _id: false });

const ornateSchema = new mongoose.Schema({
  tagNo: { type: String },
  barcode: { type: String },
  itemCode: { type: String },
  customGroupName: { type: String },
  companyCode: { type: String },
  carat: { type: String },
  groupName: { type: String },
  metalName: { type: String },
  remark: { type: String },
  ornateImages: {
    type: [{
      url: String,
      key: String,
      mediaType: { type: String, default: 'image' },
    }],
    default: undefined,
  },
  goldAmt: { type: Number },
  labourAmt: { type: Number },
  diamondAmt: { type: Number },
  stockQty: { type: Number },
  isSold: { type: Boolean, default: false },
}, { _id: false });

const seoSchema = new mongoose.Schema({
  metaTitle: { type: String, trim: true },
  metaDescription: { type: String, trim: true },
  keywords: { type: String, trim: true },
}, { _id: false });

const productSchema = new mongoose.Schema(
  {
    // ── Structured Product Blocks ─────────────────────────────
    basicInfo: {
      type: basicInfoSchema,
      default: undefined,
    },
    pricing: {
      type: pricingSchema,
      default: undefined,
    },
    specifications: {
      type: specificationsSchema,
      default: undefined,
    },
    ornate: {
      type: ornateSchema,
      default: undefined,
    },
    categoryIds: {
      type: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      }],
      default: undefined,
    },
    featuredIds: {
      type: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Featured',
      }],
      default: undefined,
    },
    menuItemIds: {
      type: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MenuItem',
      }],
      default: undefined,
    },
    sizeIds: {
      type: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Size',
      }],
      default: undefined,
    },
    metalColorIds: {
      type: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MetalColor',
      }],
      default: undefined,
    },
    metalPurityIds: {
      type: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MetalPurity',
      }],
      default: undefined,
    },

    // ── Media & Color Images ──────────────────────────────────
    productType: {
      type: String,
      enum: ['gold', 'silver', 'jewelry', 'standard', 'ornate'],
      index: true,
    },
    isOrnate: {
      type: Boolean,
      default: false,
      index: true,
    },
    colorImages: {
      type: [{
        status: {
          type: String,
          enum: ['active', 'inactive'],
          default: 'active',
          required: true,
        },
        metalColorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'MetalColor',
          required: false,
          default: null,
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
      default: undefined,
    },

    // ── Diamond Configurations ────────────────────────────────
    centerDiamondRows: {
      type: [{
        diamondTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondType' },
        diamondShapeId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondShape' },
        diamondColorId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondColor' },
        diamondClarityId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondClarity' },
        caratWeight: Number,
        pricePerCarat: Number,
        rateSource: { type: String, enum: ['master', 'manual'], default: 'master' },
      }],
      default: undefined,
    },
    sideDiamondRows: {
      type: [{
        diamondTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondType' },
        diamondShapeId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondShape' },
        diamondColorId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondColor' },
        diamondClarityId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondClarity' },
        sizeFrom: Number,
        sizeTo: Number,
        pieces: Number,
        caratWeight: Number,
        priceINR: Number,
        rateSource: { type: String, enum: ['master', 'manual'], default: 'master' },
      }],
      default: undefined,
    },

    // ── Product Variants ──────────────────────────────────────
    variants: {
      type: [{
        pricingKey: String,
        metalColorId: { type: mongoose.Schema.Types.ObjectId, ref: 'MetalColor' },
        certificateCharge: Number,
        subtotal: Number,
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
      default: undefined,
    },

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
    birthMonth: {
      type: [{
        type: String,
        enum: [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December',
        ],
      }],
      default: undefined,
    },
    seo: {
      type: seoSchema,
      default: undefined,
    },
    productSpecifications: {
      type: [{
        key: String,
        value: String,
      }],
      default: undefined,
    },
    descriptionSections: {
      type: [{
        header: { type: String, trim: true },
        description: { type: String, trim: true },
      }],
      default: undefined,
    },
  },
  {
    versionKey: false,
    strictPopulate: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for high performance querying
productSchema.index({ status: 1, 'basicInfo.isOrnate': 1 });
productSchema.index({ 'basicInfo.productType': 1, status: 1 });
productSchema.index({ categoryIds: 1, status: 1 });
productSchema.index({ 'pricing.salePrice': 1 });
productSchema.index({ 'meta.createdAt': -1 });
productSchema.pre('save', function (next) {
  const isOrnate = Boolean(this.basicInfo?.isOrnate ?? this.isOrnate);
  const tagNo = this.ornate?.tagNo;
  if (isOrnate && tagNo && !this.basicInfo?.sku) {
    this.basicInfo.sku = tagNo;
  }
  if (this.basicInfo) {
    if (isOrnate && (!this.basicInfo.productType || this.basicInfo.productType === 'ornate')) {
      this.basicInfo.productType = 'silver';
    }
    if (isOrnate) {
      this.basicInfo.isOrnate = true;
    }
  }
  const activeTitle = this.basicInfo?.title;
  if (this.basicInfo && !this.basicInfo.slug && activeTitle) {
    this.basicInfo.slug = activeTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  if (Array.isArray(this.colorImages)) {
    this.colorImages.forEach((ci) => {
      if (!ci.metalColorId || !mongoose.isValidObjectId(ci.metalColorId)) {
        ci.metalColorId = null;
      }
    });
  }
  next();
});

productSchema.plugin(metaPlugin);

module.exports = mongoose.model('Product', productSchema);
