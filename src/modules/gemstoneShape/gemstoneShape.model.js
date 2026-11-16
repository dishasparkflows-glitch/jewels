const mongoose = require('mongoose');

const gemstoneShapeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide gemstone shape name'],
      unique: true,
      trim: true,
      index: true,
    },
    code: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    iconSvg: {
      type: String,
      trim: true,
    },
    image: {
      url: String,
      key: String,
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
    meta: {
      deletedAt: { type: Date, default: null, index: true },
      deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
  },
  {
    versionKey: false,
    collection: 'gemstone_shapes',
  }
);

gemstoneShapeSchema.pre('save', function (next) {
  if (this.name && !this.code) {
    this.code = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  next();
});

module.exports = mongoose.model('GemstoneShape', gemstoneShapeSchema, 'gemstone_shapes');
