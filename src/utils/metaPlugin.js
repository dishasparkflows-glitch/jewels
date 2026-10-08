const mongoose = require('mongoose');
const { getRequestContext } = require('./context');

/**
 * Meta Plugin
 * Adds a standardized `meta` subdocument to every schema for audit tracking.
 *
 * Fields:
 *   meta.createdBy  - User who created the document
 *   meta.updatedBy  - User who last updated the document
 *   meta.deletedBy  - User who soft-deleted the document
 *   meta.createdAt  - Timestamp of creation
 *   meta.updatedAt  - Timestamp of last update
 *   meta.deletedAt  - Timestamp of soft deletion
 *
 * Usage:
 *   const metaPlugin = require('../utils/metaPlugin');
 *   mySchema.plugin(metaPlugin);
 */
function metaPlugin(schema) {
  // Prevent duplicate plugin registration
  if (schema.path('meta') || schema.paths?.['meta.createdAt']) {
    return;
  }

  schema.add({
    meta: {
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
      deletedAt: { type: Date },
    },
  });

  // Enable virtuals in toJSON & toObject for consistent API responses
  schema.set('toJSON', { virtuals: true, ...(schema.get('toJSON') || {}) });
  schema.set('toObject', { virtuals: true, ...(schema.get('toObject') || {}) });

  // Virtual getters for seamless backward compatibility with existing controllers and frontend
  if (!schema.path('createdAt') && !schema.virtuals?.createdAt) {
    schema.virtual('createdAt').get(function () {
      return this.meta?.createdAt || this._doc?.createdAt;
    });
  }
  if (!schema.path('updatedAt') && !schema.virtuals?.updatedAt) {
    schema.virtual('updatedAt').get(function () {
      return this.meta?.updatedAt || this._doc?.updatedAt;
    });
  }

  // Auto-set meta.createdAt & meta.createdBy on new docs, meta.updatedAt & meta.updatedBy on every save
  schema.pre('save', function (next) {
    if (!this.meta) {
      this.meta = {};
    }
    const currentUserId = getRequestContext('userId');
    if (!this.meta.createdAt) {
      this.meta.createdAt = this._doc?.createdAt || new Date();
    }
    if (this.isNew && currentUserId && !this.meta.createdBy) {
      this.meta.createdBy = currentUserId;
    }
    if (currentUserId) {
      this.meta.updatedBy = currentUserId;
    }
    this.meta.updatedAt = new Date();
    if (typeof next === 'function') next();
  });

  // Auto-set meta.updatedAt & meta.updatedBy on findOneAndUpdate / updateOne / updateMany
  schema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function (next) {
    const currentUserId = getRequestContext('userId');
    const update = { 'meta.updatedAt': new Date() };
    if (currentUserId) {
      update['meta.updatedBy'] = currentUserId;
    }
    this.set(update);
    if (typeof next === 'function') next();
  });

  // Auto-set meta.createdBy & meta.createdAt on insertMany
  schema.pre('insertMany', function (next, docs) {
    const currentUserId = getRequestContext('userId');
    if (Array.isArray(docs)) {
      for (const doc of docs) {
        if (!doc.meta) doc.meta = {};
        if (!doc.meta.createdAt) doc.meta.createdAt = new Date();
        doc.meta.updatedAt = new Date();
        if (currentUserId && !doc.meta.createdBy) {
          doc.meta.createdBy = currentUserId;
        }
        if (currentUserId) {
          doc.meta.updatedBy = currentUserId;
        }
      }
    }
    if (typeof next === 'function') next();
  });

  // Compatibility hook: when sorting by createdAt, sort by meta.createdAt and createdAt
  schema.pre(/^find/, function () {
    const s = this.options?.sort;
    if (s && typeof s === 'object' && s.createdAt && !s['meta.createdAt']) {
      const dir = s.createdAt;
      delete s.createdAt;
      this.options.sort = { 'meta.createdAt': dir, ...s };
    }
  });
}

module.exports = metaPlugin;
module.exports.metaPlugin = metaPlugin;
module.exports.default = metaPlugin;
