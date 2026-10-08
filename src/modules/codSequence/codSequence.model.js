const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const codSequenceSchema = new mongoose.Schema(
  {
    uptoAmount: {
      type: Number,
      required: [true, 'Please provide an upto amount'],
      min: [0, 'Amount cannot be negative'],
    },
    chargeType: {
      type: String,
      enum: {
        values: ['Fixed', 'Percentage'],
        message: '{VALUE} is not a valid charge type',
      },
      default: 'Fixed',
      required: [true, 'Please specify charge type'],
    },
    chargeValue: {
      type: Number,
      required: [true, 'Please provide charge value'],
      min: [0, 'Charge value cannot be negative'],
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
    versionKey: false,
  }
);

// Helpful index for COD calculation: find active tier where orderAmount <= uptoAmount
codSequenceSchema.index({ uptoAmount: 1, status: 1, isDeleted: 1 });

codSequenceSchema.plugin(metaPlugin);

module.exports = mongoose.model('CodSequence', codSequenceSchema);
