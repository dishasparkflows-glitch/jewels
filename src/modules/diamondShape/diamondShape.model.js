const mongoose = require('mongoose');

const diamondShapeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide diamond shape name'],
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
    collection: 'diamond_shapes',
  }
);


module.exports = mongoose.model('DiamondShape', diamondShapeSchema, 'diamond_shapes');

