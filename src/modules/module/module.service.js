const mongoose = require('mongoose');
const Module = require('./module.model');
const { SYSTEM_MODULES } = require('../owner/owner.modules');
const ApiError = require('../../utils/ApiError');
const { escapeRegex } = require('../../utils/string');

class ModuleService {
  /**
   * Ensures the currently connected database has a `modules` collection
   * seeded with every module from SYSTEM_MODULES (defaulting new entries to active).
   */
  async ensureLocalModulesSeeded() {
    if (mongoose.connection.readyState !== 1) return [];

    const now = new Date();
    const ops = SYSTEM_MODULES.map((mod) => ({
      updateOne: {
        filter: { slug: mod.id },
        update: {
          $set: {
            slug: mod.id,
            name: mod.title,
            group: mod.group || 'General',
            path: mod.path || '',
            'meta.updatedAt': now,
            'meta.deletedAt': null,
          },
          $setOnInsert: {
            status: 'active',
            'meta.createdAt': now,
            'meta.createdBy': null,
            'meta.updatedBy': null,
            'meta.deletedBy': null,
          },
        },
        upsert: true,
      },
    }));

    if (ops.length > 0) {
      await Module.bulkWrite(ops, { ordered: false });
    }

    return await this.getAll();
  }

  /**
   * Syncs the `modules` collection inside an owner's target database (`owner.databaseUrl`)
   * with each module's name and status (`active` if owner is active & module is in allowedModules, else `inactive`).
   */
  async syncOwnerDatabaseModules(owner) {
    const databaseUrl = String(owner?.databaseUrl || '').trim();
    if (!databaseUrl) return { synced: false, reason: 'Missing databaseUrl' };

    const allowedSet = new Set(Array.isArray(owner.allowedModules) ? owner.allowedModules : []);
    const ownerActive = owner.status === 'active';
    const now = new Date();

    let ownerConn = null;
    try {
      ownerConn = await mongoose.createConnection(databaseUrl, {
        serverSelectionTimeoutMS: 5000,
      }).asPromise();

      // Avoid overwriting the central admin database's own modules catalog if an owner points to the same DB
      if (
        mongoose.connection.readyState === 1 &&
        ownerConn.host === mongoose.connection.host &&
        ownerConn.name === mongoose.connection.name
      ) {
        return { synced: false, reason: 'Target database matches central database' };
      }

      const col = ownerConn.db.collection('modules');
      await col.createIndex({ slug: 1 }, { unique: true });
      await col.createIndex({ status: 1 });

      const ops = SYSTEM_MODULES.map((mod) => {
        const status = ownerActive && allowedSet.has(mod.id) ? 'active' : 'inactive';
        return {
          updateOne: {
            filter: { slug: mod.id },
            update: {
              $set: {
                slug: mod.id,
                name: mod.title,
                group: mod.group || 'General',
                path: mod.path || '',
                status,
                'meta.updatedAt': now,
                'meta.deletedAt': null,
              },
              $setOnInsert: {
                'meta.createdAt': now,
                'meta.createdBy': null,
                'meta.updatedBy': null,
                'meta.deletedBy': null,
              },
            },
            upsert: true,
          },
        };
      });

      if (ops.length > 0) {
        await col.bulkWrite(ops, { ordered: false });
      }

      return {
        synced: true,
        database: ownerConn.name,
        totalModules: ops.length,
        activeCount: ops.filter((op) => op.updateOne.update.$set.status === 'active').length,
      };
    } catch (err) {
      console.warn(`⚠️ Failed to sync modules table for owner "${owner?.name || 'unknown'}":`, err.message);
      return { synced: false, error: err.message };
    } finally {
      if (ownerConn) {
        await ownerConn.close().catch(() => {});
      }
    }
  }

  /**
   * Returns all modules stored in the current database's `modules` collection.
   */
  async getAll(queryParams = {}) {
    const filter = { 'meta.deletedAt': null };

    if (queryParams.status === 'active' || queryParams.status === 'inactive') {
      filter.status = queryParams.status;
    }

    if (queryParams.search) {
      const rx = new RegExp(escapeRegex(String(queryParams.search).trim()), 'i');
      filter.$or = [{ name: rx }, { slug: rx }, { group: rx }];
    }

    return await Module.find(filter)
      .sort({ group: 1, name: 1 })
      .lean();
  }

  /**
   * Lightweight module lookup returning only essential fields (`_id`, `slug`, `name`, `group`, `path`, `status`).
   */
  async getLookup(queryParams = {}) {
    const filter = { 'meta.deletedAt': null };

    if (queryParams.status) {
      if (queryParams.status !== 'all') {
        filter.status = queryParams.status;
      }
    } else {
      filter.status = 'active';
    }

    if (queryParams.group) {
      filter.group = String(queryParams.group).trim();
    }

    if (queryParams.search) {
      const rx = new RegExp(escapeRegex(String(queryParams.search).trim()), 'i');
      filter.$or = [{ name: rx }, { slug: rx }, { group: rx }];
    }

    return await Module.find(filter)
      .select('_id slug name group path status')
      .sort({ group: 1, name: 1 })
      .lean();
  }

  /**
   * Returns module slugs that are inactive in the local `modules` collection (empty if all are active).
   */
  async getInactiveModuleIds() {
    if (mongoose.connection.readyState !== 1) return [];
    const rows = await Module.find({ status: 'inactive', 'meta.deletedAt': null })
      .select('slug')
      .lean();
    return rows.map((r) => r.slug).filter(Boolean);
  }

  /**
   * Returns active module slugs when local `modules` restricts any module; otherwise null (unrestricted).
   */
  async getLocalRestrictedModuleIds() {
    if (mongoose.connection.readyState !== 1) return null;
    const rows = await Module.find({ 'meta.deletedAt': null })
      .select('slug status')
      .lean();
    if (!rows.length) return null;

    const hasInactive = rows.some((r) => r.status === 'inactive');
    if (!hasInactive) return null;

    return rows.filter((r) => r.status === 'active').map((r) => r.slug);
  }

  /**
   * Updates the active/inactive status of a module in the current database.
   */
  async updateStatus(identifier, status) {
    if (status !== 'active' && status !== 'inactive') {
      throw new ApiError(400, 'Status must be "active" or "inactive"');
    }

    const query = mongoose.Types.ObjectId.isValid(identifier)
      ? { $or: [{ _id: identifier }, { slug: identifier }], 'meta.deletedAt': null }
      : { slug: String(identifier).trim(), 'meta.deletedAt': null };

    const updated = await Module.findOneAndUpdate(
      query,
      { $set: { status } },
      { returnDocument: 'after', runValidators: true }
    ).lean();

    if (!updated) {
      throw new ApiError(404, 'Module not found');
    }

    return updated;
  }
}

module.exports = new ModuleService();
