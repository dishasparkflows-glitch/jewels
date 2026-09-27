const mongoose = require('mongoose');

const instagramPostSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: [true, 'Please provide Instagram post URL'],
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    position: {
      type: String,
      default: 'none',
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

instagramPostSchema.index({ isActive: 1, isDeleted: 1 });

module.exports = mongoose.model('InstagramPost', instagramPostSchema);
