const Owner = require('./owner.model');
const {
  SYSTEM_MODULES,
  VALID_MODULE_IDS,
  attachModuleConnections,
} = require('./owner.modules');
const moduleService = require('../module/module.service');
const { syncOwnerReferenceData, getOwnerSeedPreview } = require('./owner.sync');
const { escapeRegex } = require('../../utils/string');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const { encryptDatabaseUrl, decryptDatabaseUrl } = require('../../utils/encryption');

class OwnerService {
  withDecryptedDatabaseUrl(owner) {
    if (!owner) return owner;
    const obj = typeof owner.toObject === 'function' ? owner.toObject() : { ...owner };
    if (obj.databaseUrl !== undefined) {
      obj.databaseUrl = decryptDatabaseUrl(obj.databaseUrl);
    }
    return obj;
  }

  withEncryptedDatabaseUrl(owner) {
    if (!owner) return owner;
    const obj = typeof owner.toObject === 'function' ? owner.toObject() : { ...owner };
    if (obj.databaseUrl !== undefined) {
      const decrypted = decryptDatabaseUrl(obj.databaseUrl);
      const withoutQuery = String(decrypted || '').split('?')[0].replace(/\/+$/, '');
      const dbMatch = withoutQuery.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^/]+)$/i);
      const hostMatch = withoutQuery.match(/^mongodb(?:\+srv)?:\/\/(?:[^@]+@)?([^/]+)$/i);
      obj.databaseName = dbMatch?.[1] || hostMatch?.[1] || '—';
      obj.databaseUrl = /^mongodb(\+srv)?:\/\//i.test(String(obj.databaseUrl || '').trim())
        ? encryptDatabaseUrl(obj.databaseUrl)
        : obj.databaseUrl;
    }
    return obj;
  }
  normalizeModules(modulesInput) {
    if (!Array.isArray(modulesInput)) return [];
    const unique = new Set();
    for (const mod of modulesInput) {
      const id = String(mod || '').trim();
      if (id && VALID_MODULE_IDS.has(id)) {
        unique.add(id);
      }
    }
    return Array.from(unique);
  }

  // ------------------------------- get all available system modules ----------------------------
  async getAvailableModules() {
    const dbModules = await moduleService.getAll();
    const sysMap = new Map(SYSTEM_MODULES.map((m) => [m.id, m]));

    const sourceModules = dbModules.length > 0
      ? dbModules.map((m) => {
          const modSlug = m.slug || m.moduleId || m.id;
          const sys = sysMap.get(modSlug);
          return {
            id: modSlug,
            slug: modSlug,
            title: m.name || sys?.title || modSlug,
            group: m.group || sys?.group || 'General',
            path: m.path || sys?.path || '',
            status: m.status || 'active',
            apiPrefixes: sys?.apiPrefixes || [],
          };
        })
      : SYSTEM_MODULES.map((m) => ({ ...m, slug: m.id, status: 'active' }));

    const enrichedModules = attachModuleConnections(sourceModules);

    const groupOrder = [];
    const groupMap = {};

    for (const mod of enrichedModules) {
      if (!groupMap[mod.group]) {
        groupOrder.push(mod.group);
        groupMap[mod.group] = {
          group: mod.group,
          modules: [],
        };
      }
      groupMap[mod.group].modules.push(mod);
    }

    return {
      modules: enrichedModules,
      groups: groupOrder.map((g) => groupMap[g]),
      totalModules: enrichedModules.length,
    };
  }

  // ------------------------------- create owner ----------------------------
  async create(data = {}) {
    const name = String(data.name || '').trim();
    const databaseUrl = decryptDatabaseUrl(data.databaseUrl);
    const websiteUrl = String(data.websiteUrl || '').trim();

    if (!name) throw new ApiError(400, 'Owner / client name is required');
    if (!databaseUrl) throw new ApiError(400, 'Database URL is required');

    const existing = await Owner.findOne({
      name: new RegExp(`^${escapeRegex(name)}$`, 'i'),
      'meta.deletedAt': null,
    });
    if (existing) {
      throw new ApiError(409, `Owner "${name}" already exists`);
    }

    const allowedModules = this.normalizeModules(data.allowedModules);
    const status = data.status === 'inactive' ? 'inactive' : 'active';

    const syncResult = await moduleService.syncOwnerDatabaseModules({
      name,
      databaseUrl,
      allowedModules,
      status,
    });
    if (syncResult?.error) {
      throw new ApiError(
        400,
        `Failed to connect to database URL or update modules table: ${syncResult.error}`
      );
    }

    const created = await Owner.create({
      name,
      databaseUrl: encryptDatabaseUrl(databaseUrl),
      websiteUrl,
      allowedModules,
      status,
    });

    const result = this.withEncryptedDatabaseUrl(created);
    result.moduleSync = syncResult;
    return result;
  }

  // ------------------------------- get one owner ----------------------------
  async getOne(id) {
    const item = await Owner.findOne({ _id: id, 'meta.deletedAt': null }).lean();
    if (!item) {
      throw new ApiError(404, 'Owner not found');
    }
    return this.withEncryptedDatabaseUrl(item);
  }

  // ------------------------------- get all owners ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    const search = String(queryParams.search || '').trim();
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      const allItems = await Owner.find(filter)
        .sort({ 'meta.createdAt': -1 })
        .lean();

      const matched = allItems
        .filter((item) => {
          const decryptedUrl = decryptDatabaseUrl(item.databaseUrl);
          return (
            rx.test(item.name || '') ||
            rx.test(item.websiteUrl || '') ||
            rx.test(decryptedUrl || '')
          );
        })
        .map((item) => this.withEncryptedDatabaseUrl(item));

      return {
        items: matched.slice(skip, skip + limit),
        pagination: getPaginationMeta(matched.length, page, limit),
      };
    }

    const [items, total] = await Promise.all([
      Owner.find(filter)
        .sort({ 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Owner.countDocuments(filter),
    ]);

    return {
      items: items.map((item) => this.withEncryptedDatabaseUrl(item)),
      pagination: getPaginationMeta(total, page, limit),
    };
  }

  // ------------------------------- get owners lookup ----------------------------
  async getLookup() {
    return await Owner.find({ 'meta.deletedAt': null, status: 'active' })
      .sort({ name: 1 })
      .select('_id name websiteUrl allowedModules status')
      .lean();
  }

  // ------------------------------- get access config for client/owner ----------------------------
  async getAccessConfig({ ownerId, name, databaseUrl } = {}) {
    let owner = null;

    if (ownerId) {
      owner = await Owner.findOne({ _id: ownerId, 'meta.deletedAt': null })
        .select('_id name websiteUrl allowedModules status')
        .lean();
    } else if (name) {
      owner = await Owner.findOne({
        name: new RegExp(`^${escapeRegex(String(name).trim())}$`, 'i'),
        'meta.deletedAt': null,
      })
        .select('_id name websiteUrl allowedModules status')
        .lean();
    } else if (databaseUrl) {
      const targetDbUrl = decryptDatabaseUrl(databaseUrl);
      const candidates = await Owner.find({ 'meta.deletedAt': null })
        .select('_id name websiteUrl allowedModules status databaseUrl')
        .lean();
      owner = candidates.find((o) => decryptDatabaseUrl(o.databaseUrl) === targetDbUrl) || null;
    } else {
      return { restricted: false, allowedModules: null, owner: null };
    }

    if (!owner) {
      return { restricted: false, allowedModules: null, owner: null };
    }

    if (owner.status !== 'active') {
      return {
        restricted: true,
        inactive: true,
        allowedModules: [],
        owner: {
          _id: owner._id,
          name: owner.name,
          websiteUrl: owner.websiteUrl,
          status: owner.status,
        },
      };
    }

    return {
      restricted: true,
      inactive: false,
      allowedModules: Array.isArray(owner.allowedModules) ? owner.allowedModules : [],
      owner: {
        _id: owner._id,
        name: owner.name,
        websiteUrl: owner.websiteUrl,
        status: owner.status,
      },
    };
  }

  // ------------------------------- update owner ----------------------------
  async update(id, data = {}) {
    const current = await Owner.findOne({ _id: id, 'meta.deletedAt': null }).lean();
    if (!current) {
      throw new ApiError(404, 'Owner not found');
    }

    const updatePayload = {};

    if (data.name !== undefined) {
      const name = String(data.name || '').trim();
      if (!name) throw new ApiError(400, 'Owner / client name cannot be empty');
      const existing = await Owner.findOne({
        name: new RegExp(`^${escapeRegex(name)}$`, 'i'),
        _id: { $ne: id },
        'meta.deletedAt': null,
      });
      if (existing) {
        throw new ApiError(409, `Owner "${name}" already exists`);
      }
      updatePayload.name = name;
    }

    const effectiveDatabaseUrl = decryptDatabaseUrl(current.databaseUrl);

    if (data.websiteUrl !== undefined) {
      updatePayload.websiteUrl = String(data.websiteUrl || '').trim();
    }

    if (data.allowedModules !== undefined) {
      updatePayload.allowedModules = this.normalizeModules(data.allowedModules);
    }

    if (data.status !== undefined) {
      updatePayload.status = data.status === 'inactive' ? 'inactive' : 'active';
    }

    const mergedOwner = { ...current, ...updatePayload, databaseUrl: effectiveDatabaseUrl };
    const syncResult = await moduleService.syncOwnerDatabaseModules(mergedOwner);
    if (syncResult?.error) {
      throw new ApiError(
        400,
        `Failed to connect to database URL or update modules table: ${syncResult.error}`
      );
    }

    const item = await Owner.findOneAndUpdate(
      { _id: id, 'meta.deletedAt': null },
      { $set: updatePayload },
      { returnDocument: 'after', runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Owner not found');
    }

    const result = this.withEncryptedDatabaseUrl(item);
    result.moduleSync = syncResult;
    return result;
  }

  // ------------------------------- get seed preview for owner ----------------------------
  async getSeedPreview(id) {
    const owner = await Owner.findOne({ _id: id, 'meta.deletedAt': null }).lean();
    if (!owner) {
      throw new ApiError(404, 'Owner not found');
    }
    return await getOwnerSeedPreview(this.withDecryptedDatabaseUrl(owner));
  }

  // ------------------------------- seed categories & master tables for owner ----------------------------
  async seedReferenceData(id, collections = null) {
    const owner = await Owner.findOne({ _id: id, 'meta.deletedAt': null }).lean();
    if (!owner) {
      throw new ApiError(404, 'Owner not found');
    }

    const referenceDataSync = await syncOwnerReferenceData(this.withDecryptedDatabaseUrl(owner), collections);
    if (referenceDataSync?.error) {
      throw new ApiError(
        400,
        `Failed to seed categories & master tables: ${referenceDataSync.error}`
      );
    }

    return referenceDataSync;
  }

  // ------------------------------- delete owner ----------------------------
  async delete(id) {
    const item = await Owner.findOneAndUpdate(
      { _id: id, 'meta.deletedAt': null },
      { $set: { status: 'inactive', 'meta.deletedAt': new Date() } },
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'Owner not found');
    }

    await moduleService.syncOwnerDatabaseModules(this.withDecryptedDatabaseUrl(item));

    return { message: 'Owner deleted successfully', id };
  }

  // ------------------------------- bulk delete owners ----------------------------
  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, 'Please provide an array of owner IDs to delete');
    }

    const targets = await Owner.find({ _id: { $in: ids }, 'meta.deletedAt': null }).lean();

    const result = await Owner.updateMany(
      { _id: { $in: ids }, 'meta.deletedAt': null },
      { $set: { status: 'inactive', 'meta.deletedAt': new Date() } }
    );

    await Promise.all(
      targets.map((owner) =>
        moduleService.syncOwnerDatabaseModules({
          ...this.withDecryptedDatabaseUrl(owner),
          status: 'inactive',
        })
      )
    );

    return {
      message: `${result.modifiedCount} owner(s) deleted successfully`,
      deletedCount: result.modifiedCount,
      ids,
    };
  }
}

module.exports = new OwnerService();
