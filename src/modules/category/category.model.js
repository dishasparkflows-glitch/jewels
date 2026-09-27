const mongoose = require('mongoose');

const subTypeSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    code: { type: String, trim: true },
    sizeChart: {
      url: String,
      public_id: String,
    },
  },
  { _id: true }
);

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a category name'],
      trim: true,
      index: true,
    },
    slug: {
      type: String,
      trim: true,
      index: true,
    },
    images: [
      {
        url: String,
        public_id: String,
        title: String,
      },
    ],
    sizeChart: {
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
    type: {
      type: String,
      enum: ['category', 'collection'],
      default: 'category',
      index: true,
    },
    subTypes: [subTypeSchema],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

categorySchema.index({ status: 1 });
categorySchema.index({ isDeleted: 1 });
categorySchema.index({ createdAt: -1 });

categorySchema.pre('save', function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

module.exports = mongoose.model('Category', categorySchema);
