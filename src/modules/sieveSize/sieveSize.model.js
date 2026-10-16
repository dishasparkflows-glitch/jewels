const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const sieveSizeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide sieve size name'],
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
    collection: 'sieve_sizes',
  }
);
sieveSizeSchema.plugin(metaPlugin);

module.exports = mongoose.model('SieveSize', sieveSizeSchema, 'sieve_sizes');
