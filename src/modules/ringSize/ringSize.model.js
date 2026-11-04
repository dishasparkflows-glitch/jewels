const mongoose = require('mongoose');

const ringSizeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide ring size name'],
      unique: true,
      trim: true,
      index: true,
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
    collection: 'ring_sizes',
  }
);


module.exports = mongoose.model('RingSize', ringSizeSchema, 'ring_sizes');
