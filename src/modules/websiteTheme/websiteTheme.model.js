const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const mediaSchema = new mongoose.Schema({
  url: { type: String, trim: true, default: '' },
  key: { type: String, trim: true, default: '' },
  alt: { type: String, trim: true, default: '' },
}, { _id: false });

const collectionImageSchema = new mongoose.Schema({
  image: { type: mediaSchema, default: () => ({}) },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  link: { type: String, trim: true, default: '' },
}, { _id: false });

const bannerSchema = new mongoose.Schema({
  placement: { type: String, enum: ['hero', 'collection', 'promo'], default: 'hero' },
  title: { type: String, trim: true, default: '' },
  subtitle: { type: String, trim: true, default: '' },
  description: { type: String, trim: true, default: '' },
  buttonText: { type: String, trim: true, default: '' },
  link: { type: String, trim: true, default: '/shop' },
  desktopImage: { type: mediaSchema, default: () => ({}) },
  mobileImage: { type: mediaSchema, default: () => ({}) },
  collectionImages: { type: [collectionImageSchema], default: [] },
  visible: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
}, { _id: true });

const categoryAppearanceSchema = new mongoose.Schema({
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  icon: { type: mediaSchema, default: () => ({}) },
  displayName: { type: String, trim: true, default: '' },
  visible: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
}, { _id: false });

const sectionSchema = new mongoose.Schema({
  key: {
    type: String,
    enum: [
      'hero',
      'categories',
      'products',
      'collections',
      'trustBadges',
      'customBanner',
      'reviews',
      'instagram',
      'celebrate',
      'gifts',
      'mobileApp',
      'appointment',
    ],
    required: true,
  },
  visible: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
}, { _id: false });

const bannerSelectionSchema = new mongoose.Schema({
  bannerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Banner', default: null },
  type: { type: String, enum: ['herobanner', 'collectionbanner', 'categorybanner', 'offerbanner', 'customizebanner', 'mobileappbanner', 'bookappointbanner', 'websitebanner'], required: true },
  platform: { type: String, enum: ['web', 'mobile'], default: 'web' },
  order: { type: Number, min: 0, default: 1 },
  visible: { type: Boolean, default: true },
}, { _id: false });

const featuredSelectionSchema = new mongoose.Schema({
  featuredId: { type: mongoose.Schema.Types.ObjectId, ref: 'Featured', default: null },
  placement: { type: String, enum: ['Celebrate', 'Gifts'], default: 'Celebrate' },
  order: { type: Number, min: 0, default: 1 },
  visible: { type: Boolean, default: true },
}, { _id: false });

const navigationSchema = new mongoose.Schema({
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  displayName: { type: String, trim: true, default: '' },
  visible: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
}, { _id: false });

const configSchema = new mongoose.Schema({
  mediaOverrides: { type: [new mongoose.Schema({
    module: { type: String, enum: ['banner', 'category', 'featured'], required: true },
    recordId: { type: mongoose.Schema.Types.ObjectId, required: true },
    slot: { type: String, required: true },
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'ThemeMediaAsset', required: true },
  }, { _id: false })], default: [] },
  colors: {
    primary: { type: String, default: '#8B6C3A' },
    secondary: { type: String, default: '#EADCC8' },
    background: { type: String, default: '#FBF9F5' },
    surface: { type: String, default: '#FFFFFF' },
    text: { type: String, default: '#29251F' },
    accent: { type: String, default: '#A67536' },
  },
  typography: {
    headingFont: { type: String, enum: ['Cormorant Garamond', 'Playfair Display', 'Montserrat', 'Georgia'], default: 'Cormorant Garamond' },
    bodyFont: { type: String, enum: ['Montserrat', 'Inter', 'Arial', 'system-ui'], default: 'Montserrat' },
  },
  buttonStyle: { type: String, enum: ['filled', 'outline', 'pill'], default: 'filled' },
  borderRadius: { type: Number, min: 0, max: 32, default: 8 },
  seo: {
    metaTitle: { type: String, trim: true, default: '', maxlength: 70 },
    metaDescription: { type: String, trim: true, default: '', maxlength: 180 },
  },
  // Retain reads for older themes; new themes reference Banner records through bannerSelections.
  banners: { type: [bannerSchema], default: undefined },
  bannerSelections: { type: [bannerSelectionSchema], default: [] },
  featuredSelections: { type: [featuredSelectionSchema], default: [] },
  categoryAppearances: { type: [categoryAppearanceSchema], default: [] },
  navigation: { type: [navigationSchema], default: [] },
  sections: { type: [sectionSchema], default: () => [
    { key: 'hero', visible: true, order: 1 },
    { key: 'categories', visible: true, order: 2 },
    { key: 'products', visible: true, order: 3 },
    { key: 'collections', visible: true, order: 4 },
    { key: 'trustBadges', visible: true, order: 5 },
    { key: 'customBanner', visible: true, order: 6 },
    { key: 'reviews', visible: true, order: 7 },
    { key: 'instagram', visible: true, order: 8 },
  ] },
}, { _id: false });

const websiteThemeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  code: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
  description: { type: String, trim: true, default: '', maxlength: 500 },
  status: { type: String, enum: ['draft', 'scheduled', 'active', 'archived'], default: 'draft', index: true },
  config: { type: configSchema, default: () => ({}) },
  publishedSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  schedule: {
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    fallbackThemeId: { type: mongoose.Schema.Types.ObjectId, ref: 'WebsiteTheme', default: null },
  },
  publishedAt: { type: Date, default: null },
}, { versionKey: false });

websiteThemeSchema.plugin(metaPlugin);
websiteThemeSchema.index({ status: 1, 'schedule.startAt': 1, 'schedule.endAt': 1 });

const websiteThemeSettingsSchema = new mongoose.Schema({
  key: { type: String, default: 'storefront', unique: true },
  activeThemeId: { type: mongoose.Schema.Types.ObjectId, ref: 'WebsiteTheme', default: null },
  scheduledThemeId: { type: mongoose.Schema.Types.ObjectId, ref: 'WebsiteTheme', default: null },
  previousThemeId: { type: mongoose.Schema.Types.ObjectId, ref: 'WebsiteTheme', default: null },
  revision: { type: Number, default: 0 },
}, { versionKey: false, timestamps: true });

const websiteThemeHistorySchema = new mongoose.Schema({
  themeId: { type: mongoose.Schema.Types.ObjectId, ref: 'WebsiteTheme', default: null },
  themeName: { type: String, default: '' },
  action: { type: String, enum: ['created', 'duplicated', 'updated', 'scheduled', 'published', 'activated', 'expired', 'rolled_back', 'archived', 'deleted'], required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  revision: { type: Number, default: 0 },
  snapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  details: { type: String, default: '' },
}, { versionKey: false, timestamps: true });

module.exports = {
  WebsiteTheme: mongoose.models.WebsiteTheme || mongoose.model('WebsiteTheme', websiteThemeSchema, 'website_themes'),
  WebsiteThemeSettings: mongoose.models.WebsiteThemeSettings || mongoose.model('WebsiteThemeSettings', websiteThemeSettingsSchema, 'website_theme_settings'),
  WebsiteThemeHistory: mongoose.models.WebsiteThemeHistory || mongoose.model('WebsiteThemeHistory', websiteThemeHistorySchema, 'website_theme_histories'),
};
