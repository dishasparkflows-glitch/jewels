const mongoose = require('mongoose');

const moduleSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Module name is required'],
      trim: true,
    },
    group: {
      type: String,
      trim: true,
      default: 'General',
    },
    path: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
  },
  {
    versionKey: false,
    collection: 'modules',
  }
);

module.exports = mongoose.model('Module', moduleSchema, 'modules');
