const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['info', 'success', 'warning', 'error'],
      default: 'info',
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

notificationSchema.plugin(metaPlugin);

module.exports = mongoose.model('Notification', notificationSchema);
