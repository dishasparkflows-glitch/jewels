const mongoose = require('mongoose');

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
      public_id: {
        type: String,
        default: '',
      },
    },
    darkImage: {
      url: {
        type: String,
        default: '',
      },
      public_id: {
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
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

vtoMasterSchema.index({ bodyPart: 1, isDeleted: 1 });

module.exports = mongoose.model('VTOMaster', vtoMasterSchema);
