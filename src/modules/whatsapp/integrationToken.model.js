const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const integrationTokenSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      trim: true,
    },
    accountKey: {
      type: String,
      required: true,
      default: 'default',
      trim: true,
    },
    accessTokenEncrypted: {
      type: String,
      required: true,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000),
    },
    refreshAfter: {
      type: Date,
      default: () => new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000),
    },
    status: {
      type: String,
      enum: ['connected', 'disconnected'],
      default: 'connected',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    lastAuthenticatedAt: {
      type: Date,
      default: Date.now,
    },
    lastAuthError: {
      statusCode: Number,
      message: String,
      occurredAt: Date,
    },
  },
  {
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

integrationTokenSchema.index({ provider: 1, accountKey: 1 }, { unique: true });
integrationTokenSchema.plugin(metaPlugin);

module.exports = mongoose.model('IntegrationToken', integrationTokenSchema);
