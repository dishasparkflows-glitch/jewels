const mongoose = require('mongoose');
const metaPlugin = require('../../utils/metaPlugin');

const variableSchema = new mongoose.Schema(
  {
    position: {
      type: Number,
      required: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    source: {
      type: String,
      required: true,
      trim: true,
    },
    exampleValue: {
      type: String,
      default: '',
    },
    formatter: {
      type: String,
      default: '',
      trim: true,
    },
    allowEmpty: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const buttonSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['URL', 'PHONE_NUMBER', 'QUICK_REPLY'],
      default: 'URL',
    },
    text: {
      type: String,
      trim: true,
    },
    url: {
      type: String,
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const whatsAppTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['UTILITY', 'MARKETING', 'AUTHENTICATION'],
      required: true,
      default: 'UTILITY',
    },
    language: {
      type: String,
      default: 'en_US',
      trim: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'DISABLED'],
      default: 'PENDING',
      index: true,
    },
    header: {
      type: {
        type: String,
        enum: ['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'NONE'],
        default: 'NONE',
      },
      text: { type: String, default: '' },
      mediaUrl: { type: String, default: '' },
    },
    body: {
      type: String,
      required: true,
    },
    buttons: {
      type: [buttonSchema],
      default: [],
    },
    variables: {
      type: [variableSchema],
      default: [],
    },
    provider: {
      name: {
        type: String,
        default: 'connectwhats',
        trim: true,
      },
      templateId: {
        type: String,
        trim: true,
        default: '',
      },
      templateName: {
        type: String,
        trim: true,
        default: '',
      },
      status: {
        type: String,
        enum: ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED'],
        default: 'PENDING',
        index: true,
      },
      rejectionReason: {
        type: String,
        default: '',
      },
    },
    isSystemTemplate: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
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
    collection: 'whatsapp_templates',
  }
);

// Compound index for querying active approved templates
whatsAppTemplateSchema.index({ name: 1, isActive: 1, 'provider.status': 1 });
whatsAppTemplateSchema.index({ 'meta.createdAt': -1 });

whatsAppTemplateSchema.plugin(metaPlugin);

module.exports = mongoose.model('WhatsAppTemplate', whatsAppTemplateSchema, 'whatsapp_templates');
