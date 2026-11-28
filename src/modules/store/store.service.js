const Store = require('./store.model');
const ApiError = require('../../utils/ApiError');
const { escapeRegex } = require('../../utils/string');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class StoreService {
  _slugify(text = '') {
    return String(text || '')
      .toLowerCase()
      .trim()
      .replace(/^\/+|\/+$/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async _generateUniqueSlug(rawSlug, name, area, city, excludeId = null) {
    const baseSource = rawSlug || [name, area, city].filter(Boolean).join(' ') || name || 'store';
    const base = this._slugify(baseSource) || `store-${Date.now()}`;
    let candidate = base;
    let suffix = 1;

    while (true) {
      const query = excludeId ? { slug: candidate, _id: { $ne: excludeId } } : { slug: candidate };
      const existing = await Store.findOne(query).select('_id').lean();
      if (!existing) return candidate;
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
  }

  _buildFilter(queryParams = {}) {
    const filter = {};

    if (queryParams.status && queryParams.status !== 'all') {
      filter.status = queryParams.status;
    }
    if (queryParams.country && queryParams.country !== 'all') {
      filter['location.country'] = new RegExp(`^${escapeRegex(String(queryParams.country).trim())}$`, 'i');
    }
    if (queryParams.state && queryParams.state !== 'all') {
      filter['location.state'] = new RegExp(`^${escapeRegex(String(queryParams.state).trim())}$`, 'i');
    }
    if (queryParams.city && queryParams.city !== 'all') {
      filter['location.city'] = new RegExp(`^${escapeRegex(String(queryParams.city).trim())}$`, 'i');
    }
    if (queryParams.area && queryParams.area !== 'all') {
      filter['location.area'] = new RegExp(escapeRegex(String(queryParams.area).trim()), 'i');
    }
    if (queryParams.search && String(queryParams.search).trim()) {
      const searchRegex = new RegExp(escapeRegex(String(queryParams.search).trim()), 'i');
      filter.$or = [
        { name: searchRegex },
        { 'location.state': searchRegex },
        { 'location.city': searchRegex },
        { 'location.area': searchRegex },
        { 'location.address.line1': searchRegex },
        { 'location.address.line2': searchRegex },
        { 'location.address.pincode': searchRegex },
        { 'contact.phone': searchRegex },
      ];
    }

    return filter;
  }

  // ------------------------------- create store ---------------------------------
  async create(data) {
    const payload = { ...data };
    payload.slug = await this._generateUniqueSlug(
      payload.slug,
      payload.name,
      payload.location?.area,
      payload.location?.city
    );
    const store = await Store.create(payload);

    if (payload.location?.state && payload.stateIcon?.url) {
      await Store.updateMany(
        { 'location.state': new RegExp(`^${escapeRegex(payload.location.state)}$`, 'i'), _id: { $ne: store._id } },
        { $set: { stateIcon: payload.stateIcon } }
      );
    }

    return store;
  }

  // ------------------------------- get all stores -------------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = this._buildFilter(queryParams);

    const sort = queryParams.sortBy
      ? { [queryParams.sortBy]: queryParams.sortOrder === 'desc' ? -1 : 1 }
      : { 'location.state': 1, 'location.city': 1, 'location.area': 1, _id: -1 };

    const [items, total, facetRows] = await Promise.all([
      Store.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Store.countDocuments(filter),
      Store.find({})
        .select('status location.state location.city location.area stateIcon')
        .lean(),
    ]);

    let activeCount = 0;
    const statesMap = new Map();
    const citiesByState = {};
    const allCitiesSet = new Map();
    const areasByCity = {};
    const allAreasSet = new Map();
    const stateIcons = {};

    facetRows.forEach((row) => {
      if (row.status === 'active') activeCount += 1;

      const st = String(row.location?.state || '').trim();
      const ct = String(row.location?.city || '').trim();
      const ar = String(row.location?.area || '').trim();

      if (st) {
        const stKey = st.toLowerCase();
        if (!statesMap.has(stKey)) statesMap.set(stKey, st);
        if (!stateIcons[stKey] && row.stateIcon?.url) {
          stateIcons[stKey] = { url: row.stateIcon.url, key: row.stateIcon.key || '' };
        }
        if (ct) {
          if (!citiesByState[stKey]) citiesByState[stKey] = new Map();
          citiesByState[stKey].set(ct.toLowerCase(), ct);
        }
      }

      if (ct) {
        const ctKey = ct.toLowerCase();
        allCitiesSet.set(ctKey, ct);
        if (ar) {
          if (!areasByCity[ctKey]) areasByCity[ctKey] = new Map();
          areasByCity[ctKey].set(ar.toLowerCase(), ar);
        }
      }

      if (ar) {
        allAreasSet.set(ar.toLowerCase(), ar);
      }
    });

    const sortAlpha = (arr) => arr.sort((a, b) => a.localeCompare(b));

    const facets = {
      total: facetRows.length,
      active: activeCount,
      statesCount: statesMap.size,
      citiesCount: allCitiesSet.size,
      states: sortAlpha(Array.from(statesMap.values())),
      allCities: sortAlpha(Array.from(allCitiesSet.values())),
      citiesByState: Object.fromEntries(
        Object.entries(citiesByState).map(([k, map]) => [k, sortAlpha(Array.from(map.values()))])
      ),
      allAreas: sortAlpha(Array.from(allAreasSet.values())),
      areasByCity: Object.fromEntries(
        Object.entries(areasByCity).map(([k, map]) => [k, sortAlpha(Array.from(map.values()))])
      ),
      stateIcons,
    };

    return { items, pagination: getPaginationMeta(total, page, limit), facets };
  }

  // ------------------------------- get lookup (active stores) -------------------
  async getLookup(queryParams = {}) {
    const filter = this._buildFilter({ ...queryParams, status: queryParams.status || 'active' });

    const items = await Store.find(filter)
      .select('_id name slug contact location timings image stateIcon status')
      .sort({ 'location.state': 1, 'location.city': 1, 'location.area': 1, name: 1 })
      .lean();

    return items;
  }

  // ------------------------------- get states / cities / areas summary ----------
  async getStatesSummary(queryParams = {}) {
    const filter = { status: 'active' };
    if (queryParams.country && queryParams.country !== 'all') {
      filter['location.country'] = new RegExp(`^${escapeRegex(String(queryParams.country).trim())}$`, 'i');
    }

    const stores = await Store.find(filter)
      .select('location.country location.state location.city location.area stateIcon')
      .sort({ 'location.state': 1, 'location.city': 1, 'location.area': 1 })
      .lean();

    const stateMap = new Map();

    stores.forEach((store) => {
      const stateName = String(store.location?.state || '').trim();
      const cityName = String(store.location?.city || '').trim();
      const areaName = String(store.location?.area || '').trim();
      if (!stateName) return;

      const key = stateName.toLowerCase();
      if (!stateMap.has(key)) {
        stateMap.set(key, {
          state: stateName,
          country: store.location?.country || 'India',
          stateIcon: store.stateIcon?.url ? store.stateIcon : null,
          count: 0,
          citiesMap: new Map(),
        });
      } else {
        const entry = stateMap.get(key);
        if (!entry.stateIcon?.url && store.stateIcon?.url) {
          entry.stateIcon = store.stateIcon;
        }
      }

      const entry = stateMap.get(key);
      entry.count += 1;

      if (cityName) {
        const cKey = cityName.toLowerCase();
        if (!entry.citiesMap.has(cKey)) {
          entry.citiesMap.set(cKey, {
            city: cityName,
            count: 0,
            areasSet: new Set(),
          });
        }
        const cityEntry = entry.citiesMap.get(cKey);
        cityEntry.count += 1;
        if (areaName) {
          cityEntry.areasSet.add(areaName);
        }
      }
    });

    const states = Array.from(stateMap.values())
      .map((entry) => ({
        state: entry.state,
        country: entry.country,
        stateIcon: entry.stateIcon || null,
        count: entry.count,
        cities: Array.from(entry.citiesMap.values())
          .map((c) => ({
            city: c.city,
            count: c.count,
            areas: Array.from(c.areasSet).sort((a, b) => a.localeCompare(b)),
          }))
          .sort((a, b) => a.city.localeCompare(b.city)),
      }))
      .sort((a, b) => a.state.localeCompare(b.state));

    return {
      totalStores: stores.length,
      totalStates: states.length,
      states,
    };
  }

  // ------------------------------- get single store -----------------------------
  async getOne(id) {
    const store = await Store.findById(id);
    if (!store) {
      throw new ApiError(404, 'Store not found');
    }
    return store;
  }

  // ------------------------------- get store by slug ----------------------------
  async getBySlug(rawSlug) {
    const slug = this._slugify(rawSlug);
    const store = await Store.findOne({ slug, status: 'active' });
    if (!store) {
      throw new ApiError(404, 'Store not found');
    }
    return store;
  }

  // ------------------------------- update store ---------------------------------
  async update(id, data) {
    const existing = await Store.findById(id);
    if (!existing) {
      throw new ApiError(404, 'Store not found');
    }

    const payload = { ...data };
    if (payload.slug !== undefined || (!existing.slug && (payload.name || existing.name))) {
      payload.slug = await this._generateUniqueSlug(
        payload.slug || existing.slug,
        payload.name || existing.name,
        payload.location?.area || existing.location?.area,
        payload.location?.city || existing.location?.city,
        id
      );
    }

    const updated = await Store.findByIdAndUpdate(
      id,
      { $set: payload },
      { returnDocument: 'after', runValidators: true }
    );

    if (payload.location?.state && payload.stateIcon?.url !== undefined) {
      await Store.updateMany(
        { 'location.state': new RegExp(`^${escapeRegex(payload.location.state)}$`, 'i'), _id: { $ne: id } },
        { $set: { stateIcon: payload.stateIcon } }
      );
    }

    return updated;
  }

  // ------------------------------- toggle store status --------------------------
  async toggleStatus(id) {
    const store = await Store.findById(id);
    if (!store) {
      throw new ApiError(404, 'Store not found');
    }
    store.status = store.status === 'active' ? 'inactive' : 'active';
    await store.save();
    return store;
  }

  // ------------------------------- delete store ---------------------------------
  async delete(id) {
    const store = await Store.findByIdAndDelete(id);
    if (!store) {
      throw new ApiError(404, 'Store not found');
    }
    return { id, message: 'Store deleted successfully' };
  }

  // ------------------------------- bulk delete stores ---------------------------
  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, 'Please provide an array of store IDs to delete');
    }

    const result = await Store.deleteMany({ _id: { $in: ids } });
    return {
      message: `${result.deletedCount} store(s) deleted successfully`,
      deletedCount: result.deletedCount,
      ids,
    };
  }
}

module.exports = new StoreService();
