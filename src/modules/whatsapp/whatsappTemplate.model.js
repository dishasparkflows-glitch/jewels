const mongoose = require('mongoose');

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

const whatsAppTemplateSchema = new mongoose.Schema(
  {
    template: {
      name: {
        type: String,
        required: true,
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
      },
      language: {
        type: String,
        default: 'English',
        trim: true,
      },
      body: {
        type: String,
        required: true,
      },
    },
    variables: {
      type: [variableSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'DISABLED'],
      default: 'APPROVED',
      index: true,
    },
    meta: {
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
      deletedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: 'whatsapp_templates',
  }
);

whatsAppTemplateSchema.index({ 'template.name': 1 });
whatsAppTemplateSchema.index({ 'meta.createdAt': -1 });

whatsAppTemplateSchema.pre('save', function (next) {
  if (!this.meta) {
    this.meta = {};
  }
  if (!this.meta.createdAt) {
    this.meta.createdAt = new Date();
  }
  this.meta.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('WhatsAppTemplate', whatsAppTemplateSchema, 'whatsapp_templates');
