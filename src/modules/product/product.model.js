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

const productSchema = new mongoose.Schema(
  {
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
      required: [true, 'Please add at least one category'],
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
    tagNo: { type: String, index: true },
    barcode: { type: String },
    companyCode: { type: String, index: true },
    groupName: { type: String, index: true },
    itemCode: { type: String },
    itemName: { type: String },
    grossWt: { type: Number, default: 0 },
    netWt: { type: Number, default: 0 },
    fineWt: { type: Number, default: 0 },
    wastageWt: { type: Number, default: 0 },
    salesWastAmt: { type: Number, default: 0 },
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
    isSold: { type: Boolean, default: false },
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
    timestamps: true,
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
productSchema.index({ createdAt: -1 });

// Helper pre-save: sync tagNo with sku if ornate, auto-compute slug
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
  next();
});

productSchema.plugin(metaPlugin);

module.exports = mongoose.model('Product', productSchema);
