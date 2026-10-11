const mongoose = require('mongoose');

const goldPriceSchema = new mongoose.Schema(
  {
    base24KRate: {
      type: Number,
      default: 0,
    },
    platinumRate: {
      type: Number,
      default: 0,
    },
    silverRate: {
      type: Number,
      default: 0,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true, versionKey: false, collection: 'gold_prices' }
);

module.exports = mongoose.model('GoldPrice', goldPriceSchema);
