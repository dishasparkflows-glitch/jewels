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
    enum: ['gold', 'silver', 'jewelry', 'standard', 'ornate'],
  },
  gender: [{
    type: String,
    enum: ['Male', 'Female', 'Unisex', 'Kids'],
  }],
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
    category: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    }],
    categoryId: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    }],
    categoryIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    }],
    featured: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Featured',
    }],
    featuredId: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Featured',
    }],
    featuredIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Featured',
    }],
    menuItem: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
    }],
    menuItemId: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
    }],
    menuItemIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
    }],
    size: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Size',
    }],
    sizeId: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Size',
    }],
    sizeIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Size',
    }],
    metalColors: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MetalColor',
    }],
    metalColorIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MetalColor',
    }],

    // ── Media & Color Images ──────────────────────────────────
    images: [{
      url: String,
      key: String,
      mediaType: { type: String, default: 'image' },
    }],
    title: { type: String, trim: true, default: '' },
    sku: { type: String, trim: true, default: '' },
    slug: { type: String, trim: true, default: '' },
    description: { type: String, default: '' },
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
    tagNo: { type: String, index: true },
    price: { type: Number, default: 0 },
    salePrice: { type: Number, default: 0 },
    costPrice: { type: Number, default: 0 },
    displayPrice: { type: Number, default: 0 },
    mrp: { type: Number, default: 0 },
    metalName: { type: String, default: '' },
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
    strictPopulate: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for high performance querying
productSchema.index({ status: 1, 'basicInfo.isOrnate': 1 });
productSchema.index({ 'basicInfo.productType': 1, status: 1 });
productSchema.index({ categoryIds: 1, status: 1 });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ 'pricing.salePrice': 1 });
productSchema.index({ 'meta.createdAt': -1 });
productSchema.pre('save', function (next) {
  // Sync category & categoryIds
  if (this.category?.length && (!this.categoryIds || !this.categoryIds.length)) {
    this.categoryIds = this.category;
  } else if (this.categoryIds?.length && (!this.category || !this.category.length)) {
    this.category = this.categoryIds;
  }
  // Sync metalColors & metalColorIds
  if (this.metalColors?.length && (!this.metalColorIds || !this.metalColorIds.length)) {
    this.metalColorIds = this.metalColors;
  } else if (this.metalColorIds?.length && (!this.metalColors || !this.metalColors.length)) {
    this.metalColors = this.metalColorIds;
  }

  const isOrnate = Boolean(this.basicInfo?.isOrnate ?? this.isOrnate);
  const tagNo = this.ornate?.tagNo || this.tagNo;
  if (isOrnate && tagNo && !this.sku) {
    this.sku = tagNo;
  }
  if (this.basicInfo) {
    if (isOrnate && (!this.basicInfo.productType || this.basicInfo.productType === 'ornate')) {
      this.basicInfo.productType = 'silver';
    }
    if (isOrnate) {
      this.basicInfo.isOrnate = true;
    }
  }
  const activeTitle = this.basicInfo?.title || this.title;
  if (this.basicInfo && !this.basicInfo.slug && activeTitle) {
    this.basicInfo.slug = activeTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  if (!this.slug && this.basicInfo?.slug) {
    this.slug = this.basicInfo.slug;
  }
  next();
});

productSchema.plugin(metaPlugin);

module.exports = mongoose.model('Product', productSchema);
