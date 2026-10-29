const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const themeMediaMappingSchema = new mongoose.Schema(
  {
    themeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WebsiteTheme',
      required: [true, 'Theme ID is required'],
      index: true,
    },
    module: {
      type: String,
      required: [true, 'Module name is required'],
      trim: true,
      index: true,
    },
    recordId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Record ID is required'],
      index: true,
    },
    mediaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Gallery',
      required: [true, 'Media asset ID is required'],
      index: true,
    },
    device: {
      type: String,
      enum: ['desktop', 'mobile', 'app', 'common'],
      default: 'common',
      required: true,
    },
    placement: {
      type: String,
      default: 'primary',
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'theme_media_mappings',
    versionKey: false,
  }
);

themeMediaMappingSchema.plugin(metaPlugin);

// Unique compound index: one document per theme, module, record, placement, device
themeMediaMappingSchema.index(
  {
    themeId: 1,
    module: 1,
    recordId: 1,
    placement: 1,
    device: 1,
  },
  {
    unique: true,
  }
);

themeMediaMappingSchema.index({ themeId: 1, status: 1 });
themeMediaMappingSchema.index({ themeId: 1, module: 1, status: 1 });

module.exports =
  mongoose.models.ThemeMediaMapping ||
  mongoose.model('ThemeMediaMapping', themeMediaMappingSchema, 'theme_media_mappings');

