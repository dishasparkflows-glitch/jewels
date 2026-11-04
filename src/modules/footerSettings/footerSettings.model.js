const mongoose = require('mongoose');

const footerSettingsSchema = new mongoose.Schema(
  {
    // The dynamic shop items (Stored as references or items)
    shopItems: [
      {
        itemType: {
          type: String,
          default: 'Category',
        },
        itemId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Category',
        },
        title: {
          type: String,
        },
      },
    ],
    // Social Media Connectivity Hub
    socialLinks: [
      {
        platform: { type: String, required: true },
        url: { type: String, required: true },
      },
    ],
    copyright: {
      type: String,
      default: '',
    },
  },
  {
    versionKey: false,
    collection: 'footer_settings',
  }
);


module.exports = mongoose.model('FooterSettings', footerSettingsSchema, 'footer_settings');
