const mongoose = require('mongoose');

const themeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    code: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    description: { type: String, trim: true, default: '', maxlength: 500 },
    status: {
      type: String,
      enum: ['draft', 'active', 'archived', 'scheduled'],
      default: 'draft',
      index: true,
    },
    publishedSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    schedule: {
      startAt: { type: Date, default: null },
      endAt: { type: Date, default: null },
      fallbackThemeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Theme', default: null },
    },
    publishedAt: { type: Date, default: null },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ createdAt: new Date(), updatedAt: new Date(), deletedAt: null }),
    },
  },
  { versionKey: false }
);

themeSchema.index({ 'schedule.startAt': 1, 'schedule.endAt': 1 });

const Theme = mongoose.model('Theme', themeSchema, 'themes');
module.exports = {
  Theme,
};
