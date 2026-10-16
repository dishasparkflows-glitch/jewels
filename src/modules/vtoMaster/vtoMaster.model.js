const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const vtoMasterSchema = new mongoose.Schema(
  {
    bodyPart: {
      type: String,
      enum: {
        values: ['hand', 'neck', 'ear', 'wrist'],
        message: '{VALUE} is not a valid body part. Must be hand, neck, ear, or wrist',
      },
      required: [true, 'Please specify body part'],
      unique: true,
      index: true,
    },
    lightImage: {
      url: {
        type: String,
        default: '',
      },
      key: {
        type: String,
        default: '',
      },
    },
    darkImage: {
      url: {
        type: String,
        default: '',
      },
      key: {
        type: String,
        default: '',
      },
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
    collection: 'vto_masters',
  }
);



vtoMasterSchema.plugin(metaPlugin);

module.exports = mongoose.model('VTOMaster', vtoMasterSchema, 'vto_masters');
