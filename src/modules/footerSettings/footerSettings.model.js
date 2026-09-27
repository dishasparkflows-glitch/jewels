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
      default: '© 2024 Neirah Jewellers. All rights reserved.',
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('FooterSettings', footerSettingsSchema);
