const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const studdedDetailSchema = new mongoose.Schema({
  stoneName: { type: String },
  pieces: { type: Number, default: 0 },
  caratWeight: { type: Number, default: 0 },
  rate: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  clarity: { type: String },
  color: { type: String },
  cut: { type: String },
  shape: { type: String },
}, { _id: false });

const basicInfoSchema = new mongoose.Schema({
  title: { type: String, trim: true, default: '' },
  sku: { type: String, trim: true, default: '' },
  slug: { type: String, trim: true, default: '' },
  description: { type: String, default: '' },
  productType: {
    type: String,
    enum: ['jewelry', 'standard', 'ornate'],
    default: 'jewelry',
  },
  isOrnate: { type: Boolean, default: false },
}, { _id: false });

const pricingSchema = new mongoose.Schema({
  mrp: { type: Number, default: 0 },
  salePrice: { type: Number, default: 0 },
  costPrice: { type: Number, default: 0 },
  displayPrice: { type: Number, default: 0 },
  gstPercentage: { type: Number, default: 3 },
  markupPercentage: { type: Number, default: 0 },
}, { _id: false });

const specificationsSchema = new mongoose.Schema({
  metalName: { type: String, default: 'Gold' },
  metalWeight: { type: Number, default: 0 },
  metalPurity: { type: Number, default: 18 },
  grossWeight: { type: Number, default: 0 },
  netWeight: { type: Number, default: 0 },
  stoneWeight: { type: Number, default: 0 },
}, { _id: false });

const ornateSchema = new mongoose.Schema({
  tagNo: { type: String, default: '' },
  barcode: { type: String, default: '' },
  itemCode: { type: String, default: '' },
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

    title: {
      type: String,
      required: [true, 'Please add a product title'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    productType: {
      type: String,
      enum: ['jewelry', 'standard', 'ornate'],
      default: 'jewelry',
      index: true,
    },
    // Flag to distinguish ornate products in single collection
    isOrnate: {
      type: Boolean,
      default: false,
      index: true,
    },
    sku: {
      type: String,
      required: [true, 'Please add a product SKU'],
      unique: true,
      trim: true,
      index: true,
    },
    gstPercentage: {
      type: Number,
      default: 3,
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

    // ── Pricing & Costs ───────────────────────────────────────
    price: { type: Number, default: 0 },              // MRP / Original price
    salePrice: { type: Number, default: 0 },          // Actual selling price
    costPrice: { type: Number, default: 0 },          // Internal cost
    markupPercentage: { type: Number, default: 0 },   // Markup %
    calculatedPrice: { type: Number, default: 0 },    // Calculated formula price
    stockQty: { type: Number, default: 0 },
    slug: { type: String, default: '', index: true },

    category: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    }],
    subType: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    featured: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Featured',
    }],
    menuItem: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
    }],
    size: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Size',
    }],
    metalColors: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MetalColor',
    }],

    // ── Media & Color Images ──────────────────────────────────
    colorImages: [{
      metalColor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MetalColor',
      },
      images: [{
        url: String,
        public_id: String,
        mediaType: { type: String, default: 'image' },
      }],
      vtoImage: {
        url: String,
        public_id: String,
      },
      variantIcon: {
        url: String,
        public_id: String,
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
      public_id: String,
      mediaType: { type: String, default: 'image' },
    }],

    // ── Diamond Configurations ────────────────────────────────
    centerDiamondRows: [{
      diamondType: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondType' },
      diamondShape: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondShape' },
      diamondColor: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondColor' },
      diamondClarity: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondClarity' },
      caratWeight: Number,
      pricePerCarat: Number,
    }],
    sideDiamondRows: [{
      diamondType: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondType' },
      diamondShape: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondShape' },
      diamondColor: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondColor' },
      diamondClarity: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondClarity' },
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
      metalPurity: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MetalPurity',
      },
      diamondType: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DiamondType',
      },
      diamondShape: {
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
      diamondClarity: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DiamondClarity',
      },
      diamondColor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DiamondColor',
      },
      sizeFrom: Number,
      sizeTo: Number,
      caratWeight: { type: Number, default: 0 },
      otherAmount: { type: Number, default: 0 },
    }],

    // ── Ornate ERP Specific Fields (Unified Table) ───────────
    uniqueLabelID: { type: String, index: true },
    tagNo: { type: String, index: true },
    labelNo: { type: String, index: true },
    barcode: { type: String },
    barcodeNo: { type: String, index: true },
    rfid: { type: String },
    huid: { type: String },
    companyCode: { type: String, index: true },
    groupName: { type: String, index: true },
    itemCode: { type: String },
    itemName: { type: String },
    varietyName: { type: String, default: '' },
    metalName: { type: String, default: '' },
    carat: { type: String, default: '' },
    purity: { type: Number, default: 0 },
    grossWt: { type: Number, default: 0 },
    netWt: { type: Number, default: 0 },
    fineWt: { type: Number, default: 0 },
    wastageWt: { type: Number, default: 0 },
    salesWastAmt: { type: Number, default: 0 },
    stoneWt: { type: Number, default: 0 },
    stonePcs: { type: Number, default: 0 },
    diamondWt: { type: Number, default: 0 },
    diamondPcs: { type: Number, default: 0 },
    pcs: { type: Number, default: 1 },
    goldRate: { type: Number, default: 0 },
    metalRate: { type: Number, default: 0 },
    goldAmt: { type: Number, default: 0 },
    labourAmt: { type: Number, default: 0 },
    diamondAmt: { type: Number, default: 0 },
    stoneAmt: { type: Number, default: 0 },
    totalStudSalesAmt: { type: Number, default: 0 },
    totalSalesAmt: { type: Number, default: 0 },
    todaysSalesValue: { type: Number, default: 0 },
    totalAmt: { type: Number, default: 0 },
    totalCostAmt: { type: Number, default: 0 },
    gstAmt: { type: Number, default: 0 },
    gstPer: { type: Number, default: 3 },
    salesPrice: { type: Number, default: 0 },
    salesAmt: { type: Number, default: 0 },
    mrp: { type: Number, default: 0 },
    inStock: { type: Number, default: 1 },
    isSold: { type: Boolean, default: false },
    inapp: { type: Boolean, default: true },
    inweb: { type: Boolean, default: true },
    customGroupName: { type: String, default: '' },
    labelOrgDate: { type: Date, default: null },
    labelCreationDate: { type: Date, default: null },
    ornateImages: [{
      url: String,
      public_id: String,
      mediaType: { type: String, default: 'image' },
    }],
    studdedDetails: { type: [studdedDetailSchema], default: [] },
    lastSyncedAt: { type: Date, default: Date.now },
    sessionId: { type: String, default: '' },

    // ── Status & Metadata ─────────────────────────────────────
    stockStatus: {
      type: String,
      enum: ['In Stock', 'Out of Stock', 'Made to Order'],
      default: 'In Stock',
    },
    displayPrice: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'draft', 'approved'],
      default: 'active',
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
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
      enum: ['Male', 'Female', 'Unisex'],
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
productSchema.index({ title: 'text', sku: 'text', tagNo: 'text' });
productSchema.index({ status: 1, isDeleted: 1, isOrnate: 1 });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ displayPrice: 1 });
productSchema.index({ salePrice: 1 });
productSchema.index({ 'meta.createdAt': -1 });

// Helper pre-validate & pre-save: sync basicInfo, pricing, specifications, ornate with root fields
productSchema.pre('validate', function (next) {
  // ── Sync basicInfo ──────────────────────────
  if (this.basicInfo) {
    if (!this.title && this.basicInfo.title) this.title = this.basicInfo.title;
    if (!this.sku && this.basicInfo.sku) this.sku = this.basicInfo.sku;
    if (!this.slug && this.basicInfo.slug) this.slug = this.basicInfo.slug;
    if (!this.description && this.basicInfo.description) this.description = this.basicInfo.description;
    if (this.basicInfo.productType) this.productType = this.basicInfo.productType;
    if (this.basicInfo.isOrnate !== undefined) this.isOrnate = this.basicInfo.isOrnate;
  } else {
    this.basicInfo = {};
  }
  if (this.title && !this.basicInfo.title) this.basicInfo.title = this.title;
  if (this.sku && !this.basicInfo.sku) this.basicInfo.sku = this.sku;
  if (this.slug && !this.basicInfo.slug) this.basicInfo.slug = this.slug;
  if (this.description && !this.basicInfo.description) this.basicInfo.description = this.description;
  if (this.productType && !this.basicInfo.productType) this.basicInfo.productType = this.productType;
  if (this.isOrnate !== undefined) this.basicInfo.isOrnate = Boolean(this.isOrnate);

  // ── Sync pricing ────────────────────────────
  if (this.pricing) {
    if (this.pricing.mrp !== undefined && (this.price === undefined || this.price === 0)) this.price = this.pricing.mrp;
    if (this.pricing.mrp !== undefined && (this.mrp === undefined || this.mrp === 0)) this.mrp = this.pricing.mrp;
    if (this.pricing.salePrice !== undefined && (this.salePrice === undefined || this.salePrice === 0)) this.salePrice = this.pricing.salePrice;
    if (this.pricing.costPrice !== undefined && (this.costPrice === undefined || this.costPrice === 0)) this.costPrice = this.pricing.costPrice;
    if (this.pricing.displayPrice !== undefined && (this.displayPrice === undefined || this.displayPrice === 0)) this.displayPrice = this.pricing.displayPrice;
    if (this.pricing.gstPercentage !== undefined) this.gstPercentage = this.pricing.gstPercentage;
    if (this.pricing.markupPercentage !== undefined) this.markupPercentage = this.pricing.markupPercentage;
  } else {
    this.pricing = {};
  }
  if (this.pricing.mrp === undefined || this.pricing.mrp === 0) this.pricing.mrp = this.mrp || this.price || 0;
  if (this.pricing.salePrice === undefined || this.pricing.salePrice === 0) this.pricing.salePrice = this.salePrice || this.price || 0;
  if (this.pricing.costPrice === undefined || this.pricing.costPrice === 0) this.pricing.costPrice = this.costPrice || 0;
  if (this.pricing.displayPrice === undefined || this.pricing.displayPrice === 0) this.pricing.displayPrice = this.displayPrice || this.salePrice || this.price || 0;
  if (this.pricing.gstPercentage === undefined) this.pricing.gstPercentage = this.gstPercentage || 3;
  if (this.pricing.markupPercentage === undefined) this.pricing.markupPercentage = this.markupPercentage || 0;

  // ── Sync specifications ─────────────────────
  if (this.specifications) {
    if (this.specifications.metalName && !this.metalName) this.metalName = this.specifications.metalName;
    if (this.specifications.metalWeight !== undefined && !this.baseMetalWeight) this.baseMetalWeight = this.specifications.metalWeight;
    if (this.specifications.metalPurity !== undefined && !this.purity) this.purity = this.specifications.metalPurity;
    if (this.specifications.grossWeight !== undefined && !this.grossWt) this.grossWt = this.specifications.grossWeight;
    if (this.specifications.netWeight !== undefined && !this.netWt) this.netWt = this.specifications.netWeight;
    if (this.specifications.stoneWeight !== undefined && !this.stoneWt) this.stoneWt = this.specifications.stoneWeight;
  } else {
    this.specifications = {};
  }
  if (!this.specifications.metalName) this.specifications.metalName = this.metalName || 'Gold';
  if (this.specifications.metalWeight === undefined || this.specifications.metalWeight === 0) this.specifications.metalWeight = this.baseMetalWeight || this.netWt || 0;
  if (this.specifications.metalPurity === undefined || this.specifications.metalPurity === 0) this.specifications.metalPurity = this.purity || 18;
  if (this.specifications.grossWeight === undefined || this.specifications.grossWeight === 0) this.specifications.grossWeight = this.grossWt || 0;
  if (this.specifications.netWeight === undefined || this.specifications.netWeight === 0) this.specifications.netWeight = this.netWt || 0;
  if (this.specifications.stoneWeight === undefined || this.specifications.stoneWeight === 0) this.specifications.stoneWeight = this.stoneWt || 0;

  // ── Sync ornate ─────────────────────────────
  if (this.ornate) {
    if (this.ornate.tagNo && !this.tagNo) this.tagNo = this.ornate.tagNo;
    if (this.ornate.barcode && !this.barcode) this.barcode = this.ornate.barcode;
    if (this.ornate.itemCode && !this.itemCode) this.itemCode = this.ornate.itemCode;
    if (this.ornate.goldAmt !== undefined && !this.goldAmt) this.goldAmt = this.ornate.goldAmt;
    if (this.ornate.labourAmt !== undefined && !this.labourAmt) this.labourAmt = this.ornate.labourAmt;
    if (this.ornate.diamondAmt !== undefined && !this.diamondAmt) this.diamondAmt = this.ornate.diamondAmt;
    if (this.ornate.stockQty !== undefined && !this.stockQty) this.stockQty = this.ornate.stockQty;
    if (this.ornate.isSold !== undefined) this.isSold = this.ornate.isSold;
  } else {
    this.ornate = {};
  }
  if (!this.ornate.tagNo) this.ornate.tagNo = this.tagNo || '';
  if (!this.ornate.barcode) this.ornate.barcode = this.barcode || this.barcodeNo || '';
  if (!this.ornate.itemCode) this.ornate.itemCode = this.itemCode || '';
  if (this.ornate.goldAmt === undefined) this.ornate.goldAmt = this.goldAmt || 0;
  if (this.ornate.labourAmt === undefined) this.ornate.labourAmt = this.labourAmt || 0;
  if (this.ornate.diamondAmt === undefined) this.ornate.diamondAmt = this.diamondAmt || 0;
  if (this.ornate.stockQty === undefined) this.ornate.stockQty = this.stockQty || this.inStock || 0;
  if (this.ornate.isSold === undefined) this.ornate.isSold = Boolean(this.isSold);

  // Ornate tags and SKU handling
  if ((this.isOrnate || this.basicInfo?.isOrnate) && (this.tagNo || this.ornate?.tagNo) && !this.sku) {
    this.sku = this.tagNo || this.ornate?.tagNo;
    if (this.basicInfo) this.basicInfo.sku = this.sku;
  }
  if (this.isOrnate && !this.productType) {
    this.productType = 'ornate';
    if (this.basicInfo) this.basicInfo.productType = 'ornate';
  } else if (this.productType === 'ornate') {
    this.isOrnate = true;
    if (this.basicInfo) this.basicInfo.isOrnate = true;
  }

  // Slug generation
  const activeTitle = this.title || this.basicInfo?.title;
  if (!this.slug && activeTitle) {
    this.slug = activeTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  if (this.basicInfo && !this.basicInfo.slug && this.slug) {
    this.basicInfo.slug = this.slug;
  }

  next();
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
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  if (this.basicInfo && !this.basicInfo.slug && this.slug) {
    this.basicInfo.slug = this.slug;
  }
  next();
});

productSchema.plugin(metaPlugin);

module.exports = mongoose.model('Product', productSchema);
