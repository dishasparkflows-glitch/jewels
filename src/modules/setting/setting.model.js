const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const settingSchema = new mongoose.Schema(
  {
    // Business & Identity
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
    returnPeriodDays: {
      type: Number,
    },
    returnPolicy: {
      type: String,
      trim: true,
    },
    shippingPolicy: {
      type: String,
      default: '',
      trim: true,
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
    trustBadges: [{
      title: { type: String, trim: true, default: '' },
      image: {
        url: { type: String, trim: true, default: '' },
        key: { type: String, trim: true, default: '' },
      },
      order: { type: Number, default: 0 },
    }],
    mediaCompression: {
      enabled: { type: Boolean, default: true },
      quality: { type: Number, min: 50, max: 100, default: 82 },
      maxDimension: { type: Number, min: 600, max: 4000, default: 2400 },
      format: { type: String, enum: ['image/webp', 'image/jpeg'], default: 'image/webp' },
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

    // Storefront Theme & Colors (Object for buttons, header, top bar, footer)
    currentThemeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WebsiteTheme',
      default: null,
    },
    themeColors: {
      buttonColor: {
        type: String,
        trim: true,
        default: '#1f3a2b',
      },
      buttonHoverColor: {
        type: String,
        trim: true,
        default: '#162b20',
      },
      buttonTextColor: {
        type: String,
        trim: true,
        default: '#ffffff',
      },
      topBarBgColor: {
        type: String,
        trim: true,
        default: '#60574d',
      },
      topBarTextColor: {
        type: String,
        trim: true,
        default: '#ffffff',
      },
      headerBgColor: {
        type: String,
        trim: true,
        default: '#22201e',
      },
      headerTextColor: {
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
    buttonColor: {
      type: String,
      trim: true,
      default: '#1f3a2b',
    },
    buttonHoverColor: {
      type: String,
      trim: true,
      default: '#162b20',
    },
    buttonTextColor: {
      type: String,
      trim: true,
      default: '#ffffff',
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
      instagram: {
        type: String,
        default: 'https://www.instagram.com/neirah.officials?igsh=MWRrcDE3YnlhaTd6eg%3D%3D&utm_source=qr',
        trim: true,
      },
      facebook: {
        type: String,
        default: 'https://www.facebook.com/share/1Cosh9cg8h/?mibextid=wwXIfr',
        trim: true,
      },
      youtube: { type: String, default: '', trim: true },
      pinterest: { type: String, default: '', trim: true },
      twitter: { type: String, default: '', trim: true },
      linkedin: { type: String, default: '', trim: true },
      whatsapp: { type: String, default: '', trim: true },
    },
  },
  {
    versionKey: false,
  }
);

settingSchema.plugin(metaPlugin);

module.exports = mongoose.model('Setting', settingSchema);
