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
 */
function metaPlugin(schema) {
  // Prevent duplicate plugin registration
  if (schema.path('meta') || schema.paths?.['meta.createdAt']) {
    return;
  }

  // Turn off timestamps so Mongoose does not add root createdAt/updatedAt
  schema.set('timestamps', false);

  schema.add({
    meta: {
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
      deletedAt: { type: Date, default: null },
    },
  });

  // Auto-set meta.createdAt & meta.createdBy on new docs, meta.updatedAt & meta.updatedBy on every save
  schema.pre('save', function (next) {
    if (!this.meta) {
      this.meta = {};
    }
    const currentUserId = getRequestContext('userId');
    if (!this.meta.createdAt) {
      this.meta.createdAt = new Date();
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
    const now = new Date();
    const update = this.getUpdate();

    if (update) {
      if (update.$set) {
        update.$set['meta.updatedAt'] = now;
        if (currentUserId) {
          update.$set['meta.updatedBy'] = currentUserId;
        }
      } else {
        const setObj = { 'meta.updatedAt': now };
        if (currentUserId) {
          setObj['meta.updatedBy'] = currentUserId;
        }
        this.set(setObj);
      }
    } else {
      const setObj = { 'meta.updatedAt': now };
      if (currentUserId) {
        setObj['meta.updatedBy'] = currentUserId;
      }
      this.set(setObj);
    }

    if (typeof next === 'function') next();
  });

  // Auto-set meta fields on insertMany
  schema.pre('insertMany', function (next, docs) {
    const currentUserId = getRequestContext('userId');
    const now = new Date();
    if (Array.isArray(docs)) {
      for (const doc of docs) {
        if (!doc.meta) doc.meta = {};
        if (!doc.meta.createdAt) {
          doc.meta.createdAt = now;
        }
        if (!doc.meta.updatedAt) {
          doc.meta.updatedAt = now;
        }
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
}

module.exports = metaPlugin;
module.exports.metaPlugin = metaPlugin;
module.exports.default = metaPlugin;
