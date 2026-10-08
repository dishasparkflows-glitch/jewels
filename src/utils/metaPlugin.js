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

  // Ensure timestamps option is turned off so Mongoose does not add root createdAt/updatedAt
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

  // Enable virtuals in toJSON & toObject for consistent API responses
  schema.set('toJSON', { virtuals: true, ...(schema.get('toJSON') || {}) });
  schema.set('toObject', { virtuals: true, ...(schema.get('toObject') || {}) });

  // Virtual getters & setters for seamless backward compatibility with existing controllers and frontend
  if (!schema.virtuals?.createdAt) {
    schema.virtual('createdAt')
      .get(function () {
        return this.meta?.createdAt || this._doc?.createdAt;
      })
      .set(function (val) {
        if (!this.meta) this.meta = {};
        this.meta.createdAt = val;
      });
  }
  if (!schema.virtuals?.updatedAt) {
    schema.virtual('updatedAt')
      .get(function () {
        return this.meta?.updatedAt || this._doc?.updatedAt;
      })
      .set(function (val) {
        if (!this.meta) this.meta = {};
        this.meta.updatedAt = val;
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

    // Ensure root createdAt and updatedAt are stripped from stored document
    if (this._doc) {
      if ('createdAt' in this._doc) delete this._doc.createdAt;
      if ('updatedAt' in this._doc) delete this._doc.updatedAt;
    }

    if (typeof next === 'function') next();
  });

  // Auto-set meta.updatedAt & meta.updatedBy on findOneAndUpdate / updateOne / updateMany
  schema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function (next) {
    const currentUserId = getRequestContext('userId');
    const now = new Date();
    const update = this.getUpdate();

    if (update) {
      // Re-route root createdAt if passed
      if (update.createdAt !== undefined) {
        if (!update.$set) update.$set = {};
        update.$set['meta.createdAt'] = update.createdAt;
        delete update.createdAt;
      }
      if (update.$set?.createdAt !== undefined) {
        update.$set['meta.createdAt'] = update.$set.createdAt;
        delete update.$set.createdAt;
      }

      // Remove root updatedAt if passed
      if (update.updatedAt !== undefined) {
        delete update.updatedAt;
      }
      if (update.$set?.updatedAt !== undefined) {
        delete update.$set.updatedAt;
      }

      // Ensure meta.updatedAt is updated
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
          doc.meta.createdAt = doc.createdAt || now;
        }
        if (!doc.meta.updatedAt) {
          doc.meta.updatedAt = doc.updatedAt || now;
        }
        if (currentUserId && !doc.meta.createdBy) {
          doc.meta.createdBy = currentUserId;
        }
        if (currentUserId) {
          doc.meta.updatedBy = currentUserId;
        }
        delete doc.createdAt;
        delete doc.updatedAt;
      }
    }
    if (typeof next === 'function') next();
  });

  // Compatibility hook: when sorting, querying or projecting by createdAt/updatedAt, map to meta
  schema.pre(/^find/, function () {
    // 1. Rewrite sort
    const s = this.options?.sort;
    if (s) {
      if (typeof s === 'object') {
        if (s.createdAt !== undefined && !s['meta.createdAt']) {
          s['meta.createdAt'] = s.createdAt;
          delete s.createdAt;
        }
        if (s.updatedAt !== undefined && !s['meta.updatedAt']) {
          s['meta.updatedAt'] = s.updatedAt;
          delete s.updatedAt;
        }
      } else if (typeof s === 'string') {
        this.options.sort = s
          .replace(/\bcreatedAt\b/g, 'meta.createdAt')
          .replace(/\bupdatedAt\b/g, 'meta.updatedAt');
      }
    }

    // 2. Rewrite query filters
    const q = this.getQuery?.();
    if (q) {
      if (q.createdAt !== undefined && !q['meta.createdAt']) {
        q['meta.createdAt'] = q.createdAt;
        delete q.createdAt;
      }
      if (q.updatedAt !== undefined && !q['meta.updatedAt']) {
        q['meta.updatedAt'] = q.updatedAt;
        delete q.updatedAt;
      }
    }

    // 3. Rewrite select / projection if createdAt or updatedAt was selected
    const fields = this._fields;
    if (fields && typeof fields === 'object') {
      if (fields.createdAt && !fields['meta.createdAt']) {
        fields['meta.createdAt'] = fields.createdAt;
        delete fields.createdAt;
      }
      if (fields.updatedAt && !fields['meta.updatedAt']) {
        fields['meta.updatedAt'] = fields.updatedAt;
        delete fields.updatedAt;
      }
    }
  });

  // Rewrite aggregate $sort stages
  schema.pre('aggregate', function () {
    const pipeline = this.pipeline();
    for (const stage of pipeline) {
      if (stage.$sort) {
        if (stage.$sort.createdAt !== undefined && !stage.$sort['meta.createdAt']) {
          stage.$sort['meta.createdAt'] = stage.$sort.createdAt;
          delete stage.$sort.createdAt;
        }
        if (stage.$sort.updatedAt !== undefined && !stage.$sort['meta.updatedAt']) {
          stage.$sort['meta.updatedAt'] = stage.$sort.updatedAt;
          delete stage.$sort.updatedAt;
        }
      }
    }
  });

  // Attach virtual properties to lean results for complete backward compatibility
  function attachLeanVirtuals(docs) {
    if (!docs) return;
    const isArray = Array.isArray(docs);
    const list = isArray ? docs : [docs];
    for (const d of list) {
      if (d && typeof d === 'object') {
        if (d.createdAt === undefined && d.meta?.createdAt) {
          d.createdAt = d.meta.createdAt;
        }
        if (d.updatedAt === undefined && d.meta?.updatedAt) {
          d.updatedAt = d.meta.updatedAt;
        }
      }
    }
  }

  schema.post(/^find/, attachLeanVirtuals);
  schema.post('findOne', attachLeanVirtuals);
  schema.post('findOneAndUpdate', attachLeanVirtuals);
}

module.exports = metaPlugin;
module.exports.metaPlugin = metaPlugin;
module.exports.default = metaPlugin;
