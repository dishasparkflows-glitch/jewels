const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const birthstoneSchema = new mongoose.Schema(
  {
    month: {
      type: String,
      required: [true, 'Please add a month'],
      unique: true,
      enum: [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
      ],
      index: true,
    },
    stoneName: {
      type: String,
      required: [true, 'Please add a stone name'],
      trim: true,
    },
    color: {
      type: String,
      default: '',
    },
    meaning: {
      type: String,
      default: '',
    },
    image: {
      url: { type: String, default: '' },
      public_id: { type: String, default: '' },
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
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

birthstoneSchema.index({ status: 1, isDeleted: 1 });

birthstoneSchema.plugin(metaPlugin);

module.exports = mongoose.model('Birthstone', birthstoneSchema);
