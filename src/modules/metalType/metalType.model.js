const mongoose = require('mongoose');

const metalTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide metal type name'],
      unique: true,
      trim: true,
      index: true,
    },
    karat: {
      type: Number,
      default: 0,
    },
    metalColor: {
      type: String,
      trim: true,
      default: '',
    },
    image: {
      url: String,
      public_id: String,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

metalTypeSchema.index({ status: 1, isDeleted: 1 });

module.exports = mongoose.model('MetalType', metalTypeSchema);
