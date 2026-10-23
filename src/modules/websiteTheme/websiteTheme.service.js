const mongoose = require('mongoose');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const Category = require('../category/category.model');
const Banner = require('../banner/banner.model');
const { WebsiteTheme, WebsiteThemeSettings, WebsiteThemeHistory } = require('./websiteTheme.model');
const themeMedia = require('./themeMedia');

const TIMEZONE = 'Asia/Kolkata';
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const SECTION_KEYS = ['hero', 'categories', 'products', 'collections', 'trustBadges', 'customBanner', 'reviews', 'instagram'];
const BANNER_TYPES = ['herobanner', 'collectionbanner', 'categorybanner', 'offerbanner', 'mobileappbanner', 'bookappointbanner', 'websitebanner'];

const snapshotOf = (theme) => ({
  id: String(theme._id),
  name: theme.name,
  code: theme.code,
  config: theme.config?.toObject ? theme.config.toObject() : theme.config,
});

class WebsiteThemeService {
  async validateConfig(config = {}, { requireComplete = false, requireActiveBanners = false } = {}) {
    for (const row of config.mediaOverrides || []) {
      await themeMedia.validateTarget(row.module, row.recordId, row.slot);
      if (!await themeMedia.Asset.exists({ _id: row.assetId })) throw new ApiError(400, 'Theme image asset is missing');
    }
    const colors = config.colors || {};
    for (const [key, value] of Object.entries(colors)) {
      if (!HEX_COLOR.test(value)) throw new ApiError(400, `Invalid ${key} color. Use a six-digit hex color.`);
    }
    if (config.borderRadius !== undefined && (Number(config.borderRadius) < 0 || Number(config.borderRadius) > 32)) {
      throw new ApiError(400, 'Border radius must be between 0 and 32 pixels.');
    }
    if (config.sections) {
      const keys = config.sections.map((section) => section.key);
      if (keys.some((key) => !SECTION_KEYS.includes(key)) || new Set(keys).size !== keys.length) {
        throw new ApiError(400, 'Sections must use unique supported keys.');
      }
    }
    const ensureUniqueCategoryIds = (rows, fieldName) => {
      const ids = rows.map((row) => String(row.categoryId?._id || row.categoryId || ''));
      if (ids.some((id) => !mongoose.isValidObjectId(id))) throw new ApiError(400, `${fieldName} entries must reference an existing category ID.`);
      if (new Set(ids).size !== ids.length) throw new ApiError(400, `${fieldName} cannot contain the same category more than once.`);
    };
    if (config.categoryAppearances) ensureUniqueCategoryIds(config.categoryAppearances, 'Category appearance');
    if (config.navigation) ensureUniqueCategoryIds(config.navigation, 'Navigation');
    const bannerSelections = config.bannerSelections || [];
    if (bannerSelections.length > 100) throw new ApiError(400, 'A theme can reference at most 100 website banners.');
    for (const selection of bannerSelections) {
      if (!BANNER_TYPES.includes(selection.type)) throw new ApiError(400, 'Theme banner selections must use a supported banner type.');
      if (!['web', 'mobile'].includes(selection.platform || 'web')) throw new ApiError(400, 'Theme banner platform must be web or mobile.');
    }
    const selectedBannerIds = bannerSelections.map((selection) => selection.bannerId?._id || selection.bannerId).filter(Boolean);
    if (selectedBannerIds.some((id) => !mongoose.isValidObjectId(id))) throw new ApiError(400, 'Theme banner selections must reference valid banner IDs.');
    if (new Set(selectedBannerIds.map(String)).size !== selectedBannerIds.length) throw new ApiError(400, 'A website banner can only be selected once per theme.');
    if (selectedBannerIds.length) {
      const referencedBanners = await Banner.find({ _id: { $in: selectedBannerIds }, 'meta.deletedAt': null })
        .select('_id display.type display.platform status')
        .lean();
      const referencedById = new Map(referencedBanners.map((banner) => [String(banner._id), banner]));
      for (const selection of bannerSelections) {
        const bannerId = selection.bannerId?._id || selection.bannerId;
        if (!bannerId) {
          if (requireComplete && selection.visible !== false) throw new ApiError(400, 'Select a website banner for each visible theme banner slot before publishing.');
          continue;
        }
        const banner = referencedById.get(String(bannerId));
        if (!banner) throw new ApiError(400, 'A selected website banner no longer exists.');
        if (banner.display?.type !== selection.type || (banner.display?.platform || 'web') !== (selection.platform || 'web')) {
          throw new ApiError(400, 'Each theme banner selection must match the selected banner type and platform.');
        }
        if (selection.visible !== false && (requireActiveBanners || requireComplete) && banner.status !== 'active') {
          throw new ApiError(400, 'Visible theme banner selections must reference active website banners.');
        }
      }
    } else if (requireComplete && bannerSelections.some((selection) => selection.visible !== false)) {
      throw new ApiError(400, 'Select existing website banners before publishing visible theme banner slots.');
    }
    const categoryIds = [
      ...(config.categoryAppearances || []).map((row) => row.categoryId?._id || row.categoryId),
      ...(config.navigation || []).map((row) => row.categoryId?._id || row.categoryId),
      ...(config.banners || []).flatMap((banner) => (banner.collectionImages || []).map((row) => row.categoryId?._id || row.categoryId)),
    ].filter(Boolean);
    if (categoryIds.some((id) => !mongoose.isValidObjectId(id))) {
      throw new ApiError(400, 'Theme category settings must reference valid category IDs.');
    }
    if (categoryIds.length) {
      const existingCount = await Category.countDocuments({ _id: { $in: categoryIds }, 'meta.deletedAt': null });
      if (existingCount !== new Set(categoryIds.map(String)).size) throw new ApiError(400, 'Theme category settings must reference existing categories.');
    }
    if ((config.banners || []).length > 20) throw new ApiError(400, 'A theme can contain at most 20 banners.');
    if ((config.categoryAppearances || []).length > 100) throw new ApiError(400, 'A theme can contain at most 100 category overrides.');
    const validateAsset = (asset) => {
      if (!asset?.url) return;
      if (!asset.url.startsWith('/') && !/^https:\/\//i.test(asset.url)) {
        throw new ApiError(400, 'Theme media must use an HTTPS or site-relative URL.');
      }
      if (asset.key && asset.key.includes('..')) throw new ApiError(400, 'Invalid theme media storage key.');
    };
    for (const banner of config.banners || []) {
      if (banner.link && !banner.link.startsWith('/') && !/^https:\/\//i.test(banner.link)) {
        throw new ApiError(400, 'Banner links must be site paths or HTTPS URLs.');
      }
      validateAsset(banner.desktopImage);
      validateAsset(banner.mobileImage);
      for (const item of banner.collectionImages || []) {
        validateAsset(item.image);
        if (item.link && !item.link.startsWith('/') && !/^https:\/\//i.test(item.link)) throw new ApiError(400, 'Collection links must be site paths or HTTPS URLs.');
      }
      if (banner.placement === 'collection' && (banner.collectionImages || []).length > 4) {
        throw new ApiError(400, 'A collection banner can contain exactly four image slots.');
      }
      if (requireComplete && banner.visible !== false) {
        if (banner.placement === 'collection' && ((banner.collectionImages || []).length !== 4 || banner.collectionImages.some((item) => !item.image?.url))) {
          throw new ApiError(400, 'Each collection banner must contain exactly four images before publishing.');
        }
        if (['hero', 'promo'].includes(banner.placement) && !banner.desktopImage?.url) {
          throw new ApiError(400, 'Visible hero and promo banners need a desktop image before publishing.');
        }
      }
    }
    for (const category of config.categoryAppearances || []) validateAsset(category.icon);
  }

  async writeHistory(theme, action, actorId, details = '', revision = 0) {
    return WebsiteThemeHistory.create({
      themeId: theme?._id || null,
      themeName: theme?.name || '',
      action,
      actorId: actorId || null,
      revision,
      snapshot: theme ? (['published', 'scheduled', 'activated', 'expired', 'rolled_back'].includes(action) ? theme.publishedSnapshot || snapshotOf(theme) : snapshotOf(theme)) : null,
      details,
    });
  }

  // ------------------------------- create website theme ----------------------------
  async create(data, actorId) {
    if (!data.name?.trim()) throw new ApiError(400, 'Theme name is required.');
    const code = (data.code || data.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!code) throw new ApiError(400, 'Theme code is required.');
    await this.validateConfig(data.config);
    const theme = await WebsiteTheme.create({
      name: data.name.trim(), code, description: data.description || '',
      config: data.config || {}, schedule: data.schedule || {}, meta: { createdBy: actorId, updatedBy: actorId },
    });
    await this.writeHistory(theme, 'created', actorId, 'Theme created.');
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
      WebsiteTheme.find(filter)
        .sort({ 'meta.updatedAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WebsiteTheme.countDocuments(filter),
    ]);
    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- save theme media ----------------------------
  async saveMedia(id, body, actorId) {
    return themeMedia.save(id, body, actorId);
  }

  // ------------------------------- get one website theme ----------------------------
  async getById(id) {
    if (!mongoose.isValidObjectId(id)) throw new ApiError(400, 'Invalid theme ID.');
    const theme = await WebsiteTheme.findOne({ _id: id, 'meta.deletedAt': null });
    if (!theme) throw new ApiError(404, 'Theme not found.');
    return theme;
  }

  // ------------------------------- update website theme ----------------------------
  async update(id, data, actorId) {
    const theme = await this.getById(id);
    if (theme.status === 'active') throw new ApiError(409, 'Edit the active theme by duplicating it first.');
    if (theme.status === 'archived') throw new ApiError(409, 'Archived themes cannot be edited.');
    if (data.status) throw new ApiError(400, 'Theme status can only be changed through publish, schedule, or archive actions.');
    if (data.config) {
      data.config.mediaOverrides = theme.config.mediaOverrides;
      await this.validateConfig(data.config);
    }
    for (const key of ['name', 'description', 'schedule']) {
      if (data[key] !== undefined) theme[key] = data[key];
    }
    if (data.config) {
      for (const [key, value] of Object.entries(data.config)) {
        if (key !== 'mediaOverrides') theme.set(`config.${key}`, value);
      }
    }
    if (data.code !== undefined) {
      const code = String(data.code).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const duplicate = await WebsiteTheme.exists({ _id: { $ne: theme._id }, code });
      if (!code || duplicate) throw new ApiError(409, 'Theme code is empty or already in use.');
      theme.code = code;
    }
    theme.meta.updatedBy = actorId;
    await theme.save();
    if (theme.status === 'scheduled') theme.publishedSnapshot = snapshotOf(theme);
    if (theme.status === 'scheduled') await theme.save();
    await this.writeHistory(theme, 'updated', actorId, 'Theme configuration updated.');
    return theme;
  }

  // ------------------------------- duplicate website theme ----------------------------
  async duplicate(id, actorId) {
    const source = await this.getById(id);
    const codeBase = `${source.code}-copy`;
    let code = codeBase;
    let index = 2;
    while (await WebsiteTheme.exists({ code })) code = `${codeBase}-${index++}`;
    const theme = await WebsiteTheme.create({
      name: `${source.name} Copy`, code, description: source.description,
      config: source.publishedSnapshot?.config || source.config,
      meta: { createdBy: actorId, updatedBy: actorId },
    });
    await this.writeHistory(theme, 'duplicated', actorId, `Duplicated from ${source.name}.`);
    return theme;
  }

  async settings() {
    try {
      return await WebsiteThemeSettings.findOneAndUpdate(
        { key: 'storefront' }, { $setOnInsert: { key: 'storefront' } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      if (error.code === 11000) return WebsiteThemeSettings.findOne({ key: 'storefront' });
      throw error;
    }
  }

  async setActive(theme, actorId, action = 'published') {
    if (!theme.publishedSnapshot) {
      await this.validateConfig(theme.config);
      theme.publishedSnapshot = snapshotOf(theme);
    }
    const settings = await this.settings();
    const previousId = settings.activeThemeId && String(settings.activeThemeId) !== String(theme._id)
      ? settings.activeThemeId
      : settings.previousThemeId;

    // The settings document is the single atomic source of truth read by storefront clients.
    const updatedSettings = await WebsiteThemeSettings.findOneAndUpdate(
      { key: 'storefront' },
      { $set: { activeThemeId: theme._id, scheduledThemeId: null, previousThemeId: previousId || null }, $inc: { revision: 1 } },
      { new: true }
    );
    if (settings.scheduledThemeId && String(settings.scheduledThemeId) !== String(theme._id)) {
      await WebsiteTheme.updateOne({ _id: settings.scheduledThemeId, status: 'scheduled' }, { $set: { status: 'draft', 'schedule.startAt': null } });
    }
    await WebsiteTheme.updateMany({ status: 'active', _id: { $ne: theme._id } }, { $set: { status: 'draft' } });
    theme.status = 'active';
    theme.publishedAt = new Date();
    theme.schedule.startAt = null;
    theme.meta.updatedBy = actorId || theme.meta.updatedBy;
    await theme.save();
    await this.writeHistory(theme, action, actorId, '', updatedSettings.revision);
    return { theme, revision: updatedSettings.revision };
  }

  // ------------------------------- publish website theme ----------------------------
  async publish(id, data = {}, actorId) {
    const theme = await this.getById(id);
    if (theme.status === 'archived') throw new ApiError(409, 'Restore an archived theme by duplicating it before publishing.');
    const requireComplete = data.requireComplete === true;
    await this.validateConfig(theme.config, { requireComplete, requireActiveBanners: requireComplete });
    const startAt = data.startAt ? new Date(data.startAt) : null;
    const endAt = data.endAt ? new Date(data.endAt) : null;
    if (startAt && Number.isNaN(startAt.getTime())) throw new ApiError(400, 'Invalid schedule start date.');
    if (endAt && Number.isNaN(endAt.getTime())) throw new ApiError(400, 'Invalid schedule end date.');
    if (endAt && endAt <= (startAt || new Date())) throw new ApiError(400, 'End date must be later than the start date.');
    if (data.fallbackThemeId) {
      const fallback = await this.getById(data.fallbackThemeId);
      if (String(fallback._id) === String(theme._id)) throw new ApiError(400, 'A theme cannot fall back to itself.');
      if (fallback.status === 'scheduled') throw new ApiError(400, 'A scheduled theme cannot be used as an expiry fallback.');
      if (!fallback.publishedSnapshot) throw new ApiError(400, 'The fallback must have a published version.');
    }
    if (startAt && startAt > new Date()) {
      theme.schedule = { startAt, endAt, fallbackThemeId: data.fallbackThemeId || null };
      theme.status = 'scheduled';
      theme.publishedSnapshot = snapshotOf(theme);
      await theme.save();
      const settings = await this.settings();
      if (settings.scheduledThemeId && String(settings.scheduledThemeId) !== String(theme._id)) {
        await WebsiteTheme.updateOne({ _id: settings.scheduledThemeId, status: 'scheduled' }, { $set: { status: 'draft', 'schedule.startAt': null } });
      }
      settings.scheduledThemeId = theme._id;
      await settings.save();
      await this.writeHistory(theme, 'scheduled', actorId, `Scheduled for ${startAt.toISOString()}.`, settings.revision);
      return { theme, scheduled: true, revision: settings.revision };
    }
    theme.schedule = { startAt: null, endAt, fallbackThemeId: data.fallbackThemeId || null };
    theme.publishedSnapshot = snapshotOf(theme);
    await theme.save();
    return { ...(await this.setActive(theme, actorId, 'published')), scheduled: false };
  }

  // ------------------------------- archive website theme ----------------------------
  async archive(id, actorId) {
    const theme = await this.getById(id);
    const settings = await this.settings();
    if (String(settings.activeThemeId || '') === String(theme._id)) throw new ApiError(409, 'The active theme cannot be archived.');
    if (String(settings.scheduledThemeId || '') === String(theme._id)) {
      settings.scheduledThemeId = null;
      await settings.save();
    }
    theme.status = 'archived';
    await theme.save();
    await this.writeHistory(theme, 'archived', actorId, 'Theme archived.');
    return theme;
  }

  // ------------------------------- rollback website theme ----------------------------
  async rollback(id, actorId) {
    const theme = await this.getById(id);
    if (!theme.publishedSnapshot) throw new ApiError(409, 'This theme has no published version to restore.');
    theme.config = theme.publishedSnapshot.config;
    return this.setActive(theme, actorId, 'rolled_back');
  }

  // ------------------------------- preview website theme ----------------------------
  async preview(id) {
    const theme = await this.getById(id);
    const snapshot = snapshotOf(theme);
    snapshot.config = await themeMedia.resolve(snapshot.config);
    return snapshot;
  }

  // ------------------------------- get public config ----------------------------
  async getPublicConfig() {
    const settings = await this.settings();
    if (!settings.activeThemeId) return { revision: settings.revision, timezone: TIMEZONE, theme: null };
    const theme = await WebsiteTheme.findById(settings.activeThemeId).lean();
    return {
      revision: settings.revision,
      timezone: TIMEZONE,
      theme: theme?.publishedSnapshot ? { ...theme.publishedSnapshot, config: await themeMedia.resolve(theme.publishedSnapshot.config) } : null,
    };
  }

  // ------------------------------- get theme publishing history ----------------------------
  async getHistory(id) {
    const filter = {};
    if (id) filter.themeId = id;
    return WebsiteThemeHistory.find(filter).sort({ createdAt: -1 }).limit(100).populate('actorId', 'name email').lean();
  }

  // ------------------------------- reconcile theme schedule ----------------------------
  async reconcileSchedule() {
    const settings = await this.settings();
    const now = new Date();
    if (settings.scheduledThemeId) {
      const scheduled = await WebsiteTheme.findOne({ _id: settings.scheduledThemeId, status: 'scheduled' });
      if (scheduled?.schedule?.startAt && scheduled.schedule.startAt <= now) {
        await this.setActive(scheduled, null, 'activated');
        return;
      }
    }
    if (settings.activeThemeId) {
      const active = await WebsiteTheme.findById(settings.activeThemeId);
      if (active?.schedule?.endAt && active.schedule.endAt <= now) {
        const fallbackId = active.schedule.fallbackThemeId || settings.previousThemeId;
        const fallback = fallbackId ? await WebsiteTheme.findById(fallbackId) : null;
        active.status = 'draft';
        await active.save();
        if (fallback?.publishedSnapshot) {
          fallback.config = fallback.publishedSnapshot.config;
          await this.setActive(fallback, null, 'expired');
        } else {
          const updated = await WebsiteThemeSettings.findOneAndUpdate(
            { key: 'storefront', activeThemeId: active._id },
            { $set: { activeThemeId: null, scheduledThemeId: null, previousThemeId: active._id }, $inc: { revision: 1 } },
            { new: true }
          );
          if (updated) await this.writeHistory(active, 'expired', null, 'Theme expired; no fallback theme was configured.', updated.revision);
        }
      }
    }
  }
}

const websiteThemeService = new WebsiteThemeService();
Object.setPrototypeOf(module.exports, WebsiteThemeService.prototype);
Object.assign(module.exports, websiteThemeService);
