const Owner = require('./owner.model');
const { SYSTEM_MODULES, VALID_MODULE_IDS } = require('./owner.modules');
const moduleService = require('../module/module.service');
const { escapeRegex } = require('../../utils/string');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class OwnerService {
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

    const groupOrder = [];
    const groupMap = {};

    for (const mod of sourceModules) {
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
      modules: sourceModules,
      groups: groupOrder.map((g) => groupMap[g]),
      totalModules: sourceModules.length,
    };
  }

  // ------------------------------- create owner ----------------------------
  async create(data = {}) {
    const name = String(data.name || '').trim();
    const databaseUrl = String(data.databaseUrl || '').trim();
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

    const created = await Owner.create({
      name,
      databaseUrl,
      websiteUrl,
      allowedModules,
      status: data.status === 'inactive' ? 'inactive' : 'active',
    });

    await moduleService.syncOwnerDatabaseModules(created);
    return created;
  }

  // ------------------------------- get one owner ----------------------------
  async getOne(id) {
    const item = await Owner.findOne({ _id: id, 'meta.deletedAt': null }).lean();
    if (!item) {
      throw new ApiError(404, 'Owner not found');
    }
    return item;
  }

  // ------------------------------- get all owners ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    if (queryParams.search) {
      const rx = new RegExp(escapeRegex(queryParams.search.trim()), 'i');
      filter.$or = [{ name: rx }, { websiteUrl: rx }, { databaseUrl: rx }];
    }

    const [items, total] = await Promise.all([
      Owner.find(filter)
        .sort({ 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Owner.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
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
    const query = { 'meta.deletedAt': null };

    if (ownerId) {
      query._id = ownerId;
    } else if (name) {
      query.name = new RegExp(`^${escapeRegex(String(name).trim())}$`, 'i');
    } else if (databaseUrl) {
      query.databaseUrl = String(databaseUrl).trim();
    } else {
      return { restricted: false, allowedModules: null, owner: null };
    }

    const owner = await Owner.findOne(query)
      .select('_id name websiteUrl allowedModules status')
      .lean();

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

    if (data.databaseUrl !== undefined) {
      const databaseUrl = String(data.databaseUrl || '').trim();
      if (!databaseUrl) throw new ApiError(400, 'Database URL cannot be empty');
      updatePayload.databaseUrl = databaseUrl;
    }

    if (data.websiteUrl !== undefined) {
      updatePayload.websiteUrl = String(data.websiteUrl || '').trim();
    }

    if (data.allowedModules !== undefined) {
      updatePayload.allowedModules = this.normalizeModules(data.allowedModules);
    }

    if (data.status !== undefined) {
      updatePayload.status = data.status === 'inactive' ? 'inactive' : 'active';
    }

    const item = await Owner.findOneAndUpdate(
      { _id: id, 'meta.deletedAt': null },
      { $set: updatePayload },
      { returnDocument: 'after', runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Owner not found');
    }

    await moduleService.syncOwnerDatabaseModules(item);

    return item;
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

    await moduleService.syncOwnerDatabaseModules(item);

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
        moduleService.syncOwnerDatabaseModules({ ...owner, status: 'inactive' })
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
