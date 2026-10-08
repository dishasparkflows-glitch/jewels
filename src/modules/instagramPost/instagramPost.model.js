const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

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

instagramPostSchema.plugin(metaPlugin);

module.exports = mongoose.model('InstagramPost', instagramPostSchema);
