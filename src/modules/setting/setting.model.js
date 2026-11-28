const mongoose = require('mongoose');

const footerLinkSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true,
    },
    path: {
      type: String,
      trim: true,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { _id: false }
);

const settingSchema = new mongoose.Schema(
  {
    // Business & Identity
    businessDetails: {
      companyName: {      
        type: String,
        trim: true,
      },
      emailAddress: {
        type: String,
        trim: true,
      },
      mobileNumber: {
        type: String,
        trim: true,
      },
      storeAddress: {
        type: String,
        trim: true,
      },
      gstCode: {
        type: String,
        trim: true,
      },
      panCode: {
        type: String,
        trim: true,
      },
      playStoreUrl: {
        type: String,
        trim: true,
        default: '',
      },
      appStoreUrl: {
        type: String,
        trim: true,
        default: '',
      },
      manufacturer: {
        type: String,
        trim: true,
        default: '',
      },
      countryOfOrigin: {
        type: String,
        trim: true,
        default: '',
      },
    },
    logoImage: {
      url: { type: String, default: '' },
      key: { type: String, default: '' },
    },
    mobileLogoImage: {
      url: { type: String, default: '' },
      key: { type: String, default: '' },
    },
    certificateImage: {
      url: { type: String, default: '' },
      key: { type: String, default: '' },
    },
    loginModalImage: {
      url: { type: String, default: '' },
      key: { type: String, default: '' },
    },

    // trust badges
    trustBadges: [{
      title: { type: String, trim: true, default: '' },
      image: {
        url: { type: String, trim: true, default: '' },
        key: { type: String, trim: true, default: '' },
      },
      order: { type: Number, default: 0 },
    }],

    // media compression
    mediaCompression: {
      enabled: { type: Boolean, default: true },
      quality: { type: Number, min: 0, max: 100, default: 82 },
      format: { type: String, default: 'image/webp' },
    },

    // Payment Gateway & Settlement
    paymentProvider: {
      type: String,
      enum: ['razorpay', 'ccavenue', 'cashfree', 'phonepe'],
      default: 'razorpay',
      trim: true,
    },

    // Monetary Settlement
    bankDetails: {
      bankName: {
        type: String,
        trim: true,
      },
      bankAccountNumber: {
        type: String,
        trim: true,
      },
      ifscCode: {
        type: String,
        trim: true,
      },
    },

    // Storefront Theme
    currentThemeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Theme',
      default: null,
    },

    // theme colors
    themeColors: {
      topBarBgColor: {
        type: String,
        trim: true,
        default: '#201e1b',
      },
      topBarTextColor: {
        type: String,
        trim: true,
        default: '#ffffff',
      },
      headerBgColor: {
        type: String,
        trim: true,
        default: '#201e1b',
      },
      headerTextColor: {
        type: String,
        trim: true,
        default: '#ffffff',
      },
      navBgColor: {
        type: String,
        trim: true,
        default: '#201e1b',
      },
      navTextColor: {
        type: String,
        trim: true,
        default: '#d6d3d1',
      },
      megaMenuBgColor: {
        type: String,
        trim: true,
        default: '#1c1a19',
      },
      megaMenuTextColor: {
        type: String,
        trim: true,
        default: '#e7e5e4',
      },
      couponBgColor: {
        type: String,
        trim: true,
        default: '#201e1b',
      },
      couponTextColor: {
        type: String,
        trim: true,
        default: '#ffffff',
      },
      footerBgColor: {
        type: String,
        trim: true,
        default: '#0f0d0b',
      },
      footerTextColor: {
        type: String,
        trim: true,
        default: '#c8b89e',
      },
    },

    // Social Proof & Urgency
    socialProof: {
      showSoldCounter: { type: Boolean, default: true },
      soldTimeHours: { type: Number, default: 3, min: 1, max: 72 },
      defaultSoldCount: { type: Number, default: 24 },
      showReviews: { type: Boolean, default: true },
      defaultReviewCount: { type: Number, default: 13 },
      defaultRating: { type: Number, default: 5, min: 1, max: 5 },
    },

    // Social Media Links
    socialMedia: {
      instagram: { type: String, default: '', trim: true },
      facebook: { type: String, default: '', trim: true },
      youtube: { type: String, default: '', trim: true },
      pinterest: { type: String, default: '', trim: true },
      twitter: { type: String, default: '', trim: true },
      linkedin: { type: String, default: '', trim: true },
      whatsapp: { type: String, default: '', trim: true },
    },

    // Top Announcement Bar Settings
    topAnnouncement: {
      _id: false,
      isEnabled: {
        type: Boolean,
        default: true,
      },
      autoplayInterval: {
        type: Number,
        default: 4000,
      },
      displayDirection: {
        type: String,
        enum: ['horizontal', 'vertical'],
        default: 'horizontal',
      },
    },

    // Birthstone Showcase Settings
    birthstones: {
      _id: false,
      showOnStorefront: {
        type: Boolean,
        default: true,
      },
    },

    // Currency Switcher Display Settings
    currency: {
      _id: false,
      showOnStorefront: {
        type: Boolean,
        default: true,
      },
    },

    // OTP Verification & Security Settings
    otpSettings: {
      _id: false,
      enableRegistrationOtp: {
        type: Boolean,
        default: true,
      },
      enableOrderOtp: {
        type: Boolean,
        default: true,
      },
    },

    // Dynamic Footer Links Configuration
    footerLinks: {
      _id: false,
      brand: {
        type: [footerLinkSchema],
        default: [],
      },
      policies: {
        type: [footerLinkSchema],
        default: [],
      },
    },

    // Master cache/revision counter for storefront freshness checks
    revision: {
      type: Number,
      default: 0,
    },
  },
  {
    versionKey: false,
  }
);

module.exports = mongoose.model('Setting', settingSchema);
