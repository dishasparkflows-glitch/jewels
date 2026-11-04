const mongoose = require('mongoose');

const diamondColorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide diamond color name'],
      unique: true,
      trim: true,
      index: true,
    },
    image: {
      url: String,
      key: String,
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
    collection: 'diamond_colors',
  }
);


module.exports = mongoose.model('DiamondColor', diamondColorSchema, 'diamond_colors');

