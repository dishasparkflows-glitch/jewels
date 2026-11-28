const mongoose = require('mongoose');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const { Theme } = require('./theme.model');
const themeMedia = require('./themeMedia');
const Setting = require('../setting/setting.model');
const TIMEZONE = 'Asia/Kolkata';

const snapshotOf = (theme) => ({
  id: String(theme._id),
  name: theme.name,
  code: theme.code,
  description: theme.description || '',
});

class ThemeService {
  async validateConfig() {
    return;
  }

  async writeHistory() {
    return null;
  }

  // ------------------------------- create website theme ----------------------------
  async create(data, actorId) {
    if (!data.name?.trim()) throw new ApiError(400, 'Theme name is required.');
    const code = (data.code || data.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!code) throw new ApiError(400, 'Theme code is required.');

    const theme = await Theme.create({
      name: data.name.trim(),
      code,
      description: data.description || '',
      schedule: data.schedule || {},
      meta: { createdBy: actorId, updatedBy: actorId },
    });
    return theme;
  }

  // ------------------------------- get all website themes ----------------------------
  async list(query = {}) {
    const { page, limit, skip } = getPagination(query);
    const filter = { 'meta.deletedAt': null };
    if (query.status && query.status !== 'all') filter.status = query.status;
    if (query.search) {
      const q = String(query.search).trim();
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { code: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') },
      ];
    }
    const [items, total] = await Promise.all([
      Theme.find(filter)
        .sort({ 'meta.updatedAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Theme.countDocuments(filter),
    ]);

    // Attach one preview gallery photo by themeId so admin can identify themes visually
    if (items && items.length > 0) {
      try {
        const Gallery = require('../gallery/gallery.model');
        const ThemeMediaMapping = require('./themeMediaMapping.model');
        const themeIds = items.map((t) => t._id);

        const [galleries, mappings] = await Promise.all([
          Gallery.find({ themeId: { $in: themeIds }, 'meta.deletedAt': null })
            .sort({ 'meta.createdAt': -1 })
            .lean(),
          ThemeMediaMapping.find({ themeId: { $in: themeIds }, status: 'active' })
            .populate('galleryId')
            .lean(),
        ]);

        const photoMap = new Map();
        for (const m of mappings) {
          const tId = String(m.themeId);
          const url = m.galleryId?.image?.url || m.galleryId?.url;
          if (!photoMap.has(tId) && url) photoMap.set(tId, url);
        }
        for (const g of galleries) {
          const tId = String(g.themeId);
          const url = g.image?.url || g.url;
          if (!photoMap.has(tId) && url) photoMap.set(tId, url);
        }

        items.forEach((t) => {
          const url = photoMap.get(String(t._id)) || null;
          t.coverImage = url ? { url } : null;
          t.galleryPhoto = url;
          t.coverUrl = url;
        });
      } catch (err) {
        console.warn('[ThemeService.list] Failed to attach preview gallery photos:', err.message);
      }
    }

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- save theme media ----------------------------
  async saveMedia(id, body, actorId) {
    return themeMedia.save(id, body, actorId);
  }

  // ------------------------------- get one website theme ----------------------------
  async getById(id) {
    if (!mongoose.isValidObjectId(id)) throw new ApiError(400, 'Invalid theme ID.');
    const theme = await Theme.findOne({ _id: id, 'meta.deletedAt': null });
    if (!theme) throw new ApiError(404, 'Theme not found.');
    return theme;
  }

  // ------------------------------- update website theme ----------------------------
  async update(id, data, actorId) {
    const theme = await this.getById(id);
    if (theme.status === 'archived') throw new ApiError(409, 'Archived themes cannot be edited.');
    if (data.status) throw new ApiError(400, 'Theme status can only be changed through publish or schedule actions.');

    for (const key of ['name', 'description', 'schedule']) {
      if (data[key] !== undefined) theme[key] = data[key];
    }
    if (data.code !== undefined) {
      const code = String(data.code).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const duplicate = await Theme.exists({ _id: { $ne: theme._id }, code });
      if (!code || duplicate) throw new ApiError(409, 'Theme code is empty or already in use.');
      theme.code = code;
    }
    theme.meta = theme.meta || {};
    theme.meta.updatedBy = actorId;
    theme.meta.updatedAt = new Date();
    await theme.save();
    if (theme.status === 'scheduled' || theme.status === 'active') {
      theme.publishedSnapshot = snapshotOf(theme);
      await theme.save();
    }
    return theme;
  }

  async settings() {
    let setting = await Setting.findOne({ 'meta.deletedAt': null });
    if (!setting) {
      setting = await Setting.findOne();
    }
    return {
      activeThemeId: setting?.currentThemeId || null,
      revision: setting?.revision || 0,
    };
  }

  async setActive(theme, actorId) {
    if (!theme.publishedSnapshot) {
      theme.publishedSnapshot = snapshotOf(theme);
    }
    await Setting.updateOne(
      { 'meta.deletedAt': null },
      { $set: { currentThemeId: theme._id } }
    );
    theme.status = 'active';
    theme.publishedAt = new Date();
    if (theme.schedule) theme.schedule.startAt = null;
    theme.meta = theme.meta || {};
    theme.meta.updatedBy = actorId || theme.meta.updatedBy;
    await theme.save();

    // When theme becomes active, take theme_media_mappings and sync mapped images to banner & featured tables
    try {
      const themeMediaMappingService = require('./themeMediaMapping.service');
      await themeMediaMappingService.syncThemeMappingsToRecords(theme._id);
    } catch (err) {
      console.warn('[ThemeService.setActive] syncThemeMappingsToRecords error:', err.message);
    }

    return { theme, success: true };
  }

  // ------------------------------- publish website theme ----------------------------
  async publish(id, data = {}, actorId) {
    const theme = await this.getById(id);
    if (theme.status === 'archived') throw new ApiError(409, 'Archived themes cannot be published.');
    const startAt = data.startAt ? new Date(data.startAt) : null;
    const endAt = data.endAt ? new Date(data.endAt) : null;
    if (startAt && Number.isNaN(startAt.getTime())) throw new ApiError(400, 'Invalid schedule start date.');
    if (endAt && Number.isNaN(endAt.getTime())) throw new ApiError(400, 'Invalid schedule end date.');
    if (endAt && endAt <= (startAt || new Date())) throw new ApiError(400, 'End date must be later than the start date.');
    if (data.fallbackThemeId) {
      const fallback = await this.getById(data.fallbackThemeId);
      if (String(fallback._id) === String(theme._id)) throw new ApiError(400, 'A theme cannot fall back to itself.');
      if (fallback.status === 'scheduled') throw new ApiError(400, 'A scheduled theme cannot be used as an expiry fallback.');
    }
    if (startAt && startAt > new Date()) {
      theme.schedule = { startAt, endAt, fallbackThemeId: data.fallbackThemeId || null };
      theme.status = 'scheduled';
      theme.publishedSnapshot = snapshotOf(theme);
      await theme.save();
      return { theme, scheduled: true };
    }
    theme.schedule = { startAt: null, endAt, fallbackThemeId: data.fallbackThemeId || null };
    theme.publishedSnapshot = snapshotOf(theme);
    await theme.save();
    return { ...(await this.setActive(theme, actorId)), scheduled: false };
  }

  // ------------------------------- remove website theme ----------------------------
  async remove(id, actorId) {
    const theme = await this.getById(id);
    theme.meta = theme.meta || {};
    theme.meta.deletedAt = new Date();
    theme.meta.deletedBy = actorId || null;
    theme.meta.updatedBy = actorId || null;
    theme.status = 'archived';
    await theme.save();
    // Clear only references to this theme; preserve unrelated live/scheduled themes.
    await Setting.updateOne(
      { currentThemeId: theme._id },
      { $set: { currentThemeId: null }, $inc: { revision: 1 } }
    );
    return { id: String(theme._id) };
  }

  // ------------------------------- get public config ----------------------------
  async getPublicConfig() {
    let activeThemeId;
    let revision = 0;

    try {
      const storeSetting = await Setting.findOne({ 'meta.deletedAt': null }).select('currentThemeId').lean();
      if (storeSetting?.currentThemeId) activeThemeId = storeSetting.currentThemeId;
    } catch (_) {}

    if (!activeThemeId) {
      const firstTheme = await Theme.findOne({ 'meta.deletedAt': null }).select('_id').lean();
      if (firstTheme) activeThemeId = firstTheme._id;
    }

    if (!activeThemeId) return { revision, timezone: TIMEZONE, theme: null };
    const theme = await Theme.findOne({ _id: activeThemeId, 'meta.deletedAt': null }).lean();
    return {
      revision,
      timezone: TIMEZONE,
      theme: theme
        ? { id: String(theme._id), name: theme.name, code: theme.code }
        : null,
    };
  }

  // ------------------------------- reconcile theme schedule ----------------------------
  async reconcileSchedule() {
    const settings = await this.settings();
    const now = new Date();
    if (settings.activeThemeId) {
      const active = await Theme.findOne({ _id: settings.activeThemeId, 'meta.deletedAt': null });
      if (active?.schedule?.endAt && active.schedule.endAt <= now) {
        const fallbackId = active.schedule.fallbackThemeId;
        const fallback = fallbackId ? await Theme.findOne({ _id: fallbackId, 'meta.deletedAt': null }) : null;
        await active.save();
        if (fallback) {
          await this.setActive(fallback, null);
          return { expiredThemeId: active._id, activatedThemeId: fallback._id };
        } else {
          await Setting.updateOne(
            { 'meta.deletedAt': null },
            { $set: { currentThemeId: null }, $inc: { revision: 1 } }
          );
          return { expiredThemeId: active._id };
        }
      }
    }
    return null;
  }
}

const themeService = new ThemeService();
Object.setPrototypeOf(module.exports, ThemeService.prototype);
Object.assign(module.exports, themeService);
