const mongoose = require('mongoose');

const themeMediaMappingSchema = new mongoose.Schema(
  {
    themeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Theme',
      required: [true, 'Theme ID is required'],
      index: true,
    },
    recordId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Record ID is required'],
      index: true,
    },
    galleryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Gallery',
      required: [true, 'Gallery asset ID is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
  },
  {
    collection: 'theme_media_mappings',
    versionKey: false,
  }
);

// Unique compound index: one document per theme and record
themeMediaMappingSchema.index(
  {
    themeId: 1,
    recordId: 1,
  },
  {
    unique: true,
  }
);

themeMediaMappingSchema.index({ themeId: 1, status: 1 });

module.exports = mongoose.model('ThemeMediaMapping', themeMediaMappingSchema, 'theme_media_mappings');
