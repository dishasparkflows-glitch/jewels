const mongoose = require('mongoose');

const instagramPostSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: [true, 'Please provide Instagram post URL'],
      trim: true,
      unique: true,
      index: true,
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


module.exports = mongoose.model('InstagramPost', instagramPostSchema, 'instagram_posts');
