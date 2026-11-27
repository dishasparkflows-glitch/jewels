const mongoose = require('mongoose');
const { getRequestContext } = require('./context');
const mediaPlugin = require('./mediaPlugin');

// Centralized registry of models that should NOT have audit metadata (meta object)
const EXCLUDED_MODELS = new Set([
  'cart',
  'wishlist',
  'codsequence',
  'currency',
  'integrationtoken',
  'whatsappmessage',
  'notification',
  'address',
  'thememediamapping',
]);

function isExcluded(name, collection) {
  const normName = String(name || '').toLowerCase().replace(/[-_]/g, '');
  const normCollection = String(collection || '').toLowerCase().replace(/[-_]/g, '');

  for (const m of EXCLUDED_MODELS) {
    if (
      normName === m ||
      normName === m + 's' ||
      (m === 'address' && normName === 'addresses') ||
      normCollection === m ||
      normCollection === m + 's' ||
      (m === 'address' && normCollection === 'addresses')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Applies audit meta tracking to a top-level schema.
 * Only called on top-level models, never on sub-schemas/subdocuments.
 */
function applyMetaPlugin(schema) {
  if (!schema || schema.path('meta') || schema.paths?.['meta.createdAt']) {
    return;
  }

  // Disable default timestamps so Mongoose does not add root createdAt/updatedAt
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

  // Index meta.deletedAt for performant soft-delete queries
  schema.index({ 'meta.deletedAt': 1 });

  // Attach mediaPlugin
  schema.plugin(mediaPlugin);

  // Query pre-hook: map isDeleted to meta.deletedAt
  schema.pre(
    [
      'find',
      'findOne',
      'countDocuments',
      'estimatedDocumentCount',
      'distinct',
      'findOneAndUpdate',
      'updateOne',
      'updateMany',
    ],
    function () {
      const filter = this.getFilter();
      if (filter && typeof filter === 'object' && 'isDeleted' in filter) {
        if (filter.isDeleted === false) {
          filter['meta.deletedAt'] = null;
        } else if (filter.isDeleted === true) {
          filter['meta.deletedAt'] = { $ne: null };
        }
        delete filter.isDeleted;
      }
    }
  );

  // Pre-save hook: auto-set createdAt/createdBy, updatedAt/updatedBy
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

  // Pre-update hooks
  schema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function (next) {
    const currentUserId = getRequestContext('userId');
    const now = new Date();
    const update = this.getUpdate();

    if (update) {
      if (update.$set) {
        if ('isDeleted' in update.$set) {
          if (update.$set.isDeleted === true) {
            update.$set['meta.deletedAt'] = now;
            if (currentUserId) update.$set['meta.deletedBy'] = currentUserId;
          } else if (update.$set.isDeleted === false) {
            update.$set['meta.deletedAt'] = null;
            update.$set['meta.deletedBy'] = null;
          }
          delete update.$set.isDeleted;
        }
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

      // Handle upsert operations: guarantee meta.createdAt and meta.createdBy on newly inserted documents
      const isUpsert = Boolean(
        this.options?.upsert || (typeof this.getOptions === 'function' && this.getOptions()?.upsert)
      );
      if (isUpsert) {
        if (!update.$setOnInsert) {
          update.$setOnInsert = {};
        }
        if (!update.$setOnInsert['meta.createdAt'] && !update.$set?.['meta.createdAt'] && !update['meta.createdAt']) {
          update.$setOnInsert['meta.createdAt'] = now;
        }
        if (
          currentUserId &&
          !update.$setOnInsert['meta.createdBy'] &&
          !update.$set?.['meta.createdBy'] &&
          !update['meta.createdBy']
        ) {
          update.$setOnInsert['meta.createdBy'] = currentUserId;
        }
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

  // Pre-insertMany hook
  schema.pre('insertMany', function (next, docs) {
    const currentUserId = getRequestContext('userId');
    const now = new Date();
    if (Array.isArray(docs)) {
      for (const doc of docs) {
        if (!doc.meta) doc.meta = {};
        if (!doc.meta.createdAt) doc.meta.createdAt = now;
        if (!doc.meta.updatedAt) doc.meta.updatedAt = now;
        if (currentUserId && !doc.meta.createdBy) doc.meta.createdBy = currentUserId;
        if (currentUserId) doc.meta.updatedBy = currentUserId;
      }
    }
    if (typeof next === 'function') next();
  });
}

// Automatically apply metaPlugin ONLY when a top-level model is registered
if (!mongoose._metaPluginModelIntercepted) {
  mongoose._metaPluginModelIntercepted = true;
  const originalModel = mongoose.model.bind(mongoose);
  mongoose.model = function (name, schema, collection) {
    if (schema) {
      const collName = collection || schema.options?.collection;
      if (!isExcluded(name, collName)) {
        applyMetaPlugin(schema);
      }
    }
    return originalModel(name, schema, collection);
  };
}

function metaPlugin(schema) {
  if (schema) {
    applyMetaPlugin(schema);
  }
}

module.exports = metaPlugin;
module.exports.metaPlugin = metaPlugin;
module.exports.default = metaPlugin;
module.exports.EXCLUDED_MODELS = EXCLUDED_MODELS;
