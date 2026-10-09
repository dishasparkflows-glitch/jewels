const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const whatsAppMessageSchema = new mongoose.Schema(
  {
    integrationTokenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'IntegrationToken',
      default: null,
    },
    provider: {
      type: String,
      required: true,
      default: 'connectwhats',
      trim: true,
    },
    to: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    from: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['text', 'template', 'image', 'video', 'document', 'audio', 'TEXT', 'TEMPLATE'],
      default: 'text',
    },
    message: {
      type: String,
    },
    templateName: {
      type: String,
      trim: true,
    },
    templateLanguage: {
      type: String,
      default: 'en_US',
    },
    variables: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    parameters: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    expectedParameterCount: {
      type: Number,
    },
    actualParameterCount: {
      type: Number,
    },
    renderedPreview: {
      type: String,
      default: '',
    },
    externalMessageId: {
      type: String,
      trim: true,
      index: true,
    },
    providerMessageId: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['queued', 'sent', 'delivered', 'read', 'failed', 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED'],
      default: 'queued',
      index: true,
    },
    error: {
      code: { type: String },
      message: { type: String },
    },
    failureReason: {
      type: String,
      default: '',
    },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    readAt: { type: Date },
    failedAt: { type: Date },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

whatsAppMessageSchema.index({ 'meta.createdAt': -1 });
whatsAppMessageSchema.index({ provider: 1, to: 1, status: 1 });

whatsAppMessageSchema.plugin(metaPlugin);

module.exports = mongoose.model('WhatsAppMessage', whatsAppMessageSchema);
