const mongoose = require('mongoose');

const caratWeightSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide carat weight name'],
      unique: true,
      trim: true,
      index: true,
    },
    weight: {
      type: Number,
      default: 0,
    },
    image: {
      url: { type: String, default: '' },
      key: { type: String, default: '' },
    },
    order: {
      type: Number,
      default: 0,
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
    collection: 'carat_weights',
  }
);


module.exports = mongoose.model('CaratWeight', caratWeightSchema, 'carat_weights');
