const mongoose = require('mongoose');

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
    collection: 'integration_tokens',
  }
);

integrationTokenSchema.index({ provider: 1, accountKey: 1 }, { unique: true });

module.exports = mongoose.model('IntegrationToken', integrationTokenSchema, 'integration_tokens');
