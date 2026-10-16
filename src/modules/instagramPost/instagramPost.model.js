const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const instagramPostSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: [true, 'Please provide Instagram post URL'],
      trim: true,
    },
    title: {
      type: String,
      trim: true,
      default: '',
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    versionKey: false,
    collection: 'instagram_posts',
  }
);

instagramPostSchema.plugin(metaPlugin);

module.exports = mongoose.model('InstagramPost', instagramPostSchema, 'instagram_posts');
