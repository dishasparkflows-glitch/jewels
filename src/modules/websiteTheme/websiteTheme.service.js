const mongoose = require('mongoose');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const Category = require('../category/category.model');
const Banner = require('../banner/banner.model');
const Featured = require('../featured/featured.model');
const { WebsiteTheme, WebsiteThemeSettings } = require('./websiteTheme.model');
const themeMedia = require('./themeMedia');
const Setting = require('../setting/setting.model');
const TIMEZONE = 'Asia/Kolkata';
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const SECTION_KEYS = [
  'hero',
  'categories',
  'products',
  'collections',
  'trustBadges',
  'customBanner',
  'reviews',
  'instagram',
  'celebrate',
  'gifts',
  'mobileApp',
  'appointment',
];
const BANNER_TYPES = ['herobanner', 'collectionbanner', 'categorybanner', 'offerbanner', 'customizebanner', 'mobileappbanner', 'bookappointbanner', 'websitebanner'];

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

    const featuredSelections = config.featuredSelections || [];
    if (featuredSelections.length > 100) throw new ApiError(400, 'A theme can reference at most 100 featured showcases.');
    for (const selection of featuredSelections) {
      if (!['Celebrate', 'Gifts'].includes(selection.placement || 'Celebrate')) {
        throw new ApiError(400, 'Theme showcase placement must be Celebrate or Gifts.');
      }
    }
    const selectedFeaturedIds = featuredSelections.map((selection) => selection.featuredId?._id || selection.featuredId).filter(Boolean);
    if (selectedFeaturedIds.some((id) => !mongoose.isValidObjectId(id))) throw new ApiError(400, 'Theme showcase selections must reference valid IDs.');
    if (new Set(selectedFeaturedIds.map(String)).size !== selectedFeaturedIds.length) throw new ApiError(400, 'A showcase can only be selected once per theme.');
    if (selectedFeaturedIds.length) {
      const referencedFeatured = await Featured.find({ _id: { $in: selectedFeaturedIds }, 'meta.deletedAt': null })
        .select('_id placement status')
        .lean();
      const referencedById = new Map(referencedFeatured.map((item) => [String(item._id), item]));
      for (const selection of featuredSelections) {
        const featuredId = selection.featuredId?._id || selection.featuredId;
        if (!featuredId) continue;
        const item = referencedById.get(String(featuredId));
        if (!item) throw new ApiError(400, 'A selected showcase no longer exists.');
      }
    }
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

  async writeHistory() {
    return null;
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
      await WebsiteTheme.updateOne({ _id: settings.scheduledThemeId, status: 'scheduled', 'meta.deletedAt': null }, { $set: { status: 'draft', 'schedule.startAt': null } });
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
        await WebsiteTheme.updateOne({ _id: settings.scheduledThemeId, status: 'scheduled', 'meta.deletedAt': null }, { $set: { status: 'draft', 'schedule.startAt': null } });
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

  async remove(id, actorId) {
    const theme = await this.getById(id);
    theme.meta.deletedAt = new Date();
    theme.meta.deletedBy = actorId || null;
    theme.meta.updatedBy = actorId || null;
    theme.status = 'archived';
    await theme.save();
    // Clear only references to this theme; preserve unrelated live/scheduled themes.
    for (const field of ['activeThemeId', 'scheduledThemeId', 'previousThemeId']) {
      await WebsiteThemeSettings.updateOne({ key: 'storefront', [field]: theme._id }, { $set: { [field]: null } });
    }
    await WebsiteTheme.updateMany({ 'schedule.fallbackThemeId': theme._id }, { $set: { 'schedule.fallbackThemeId': null } });
    const settings = await WebsiteThemeSettings.findOneAndUpdate(
      { key: 'storefront' }, { $inc: { revision: 1 } }, { new: true }
    );
    await this.writeHistory(theme, 'deleted', actorId, 'Theme deleted. Shared media retained.', settings?.revision || 0);
    return { id: String(theme._id) };
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

  // ------------------------------- get theme media library ----------------------------
  async getMediaLibrary(id) {
    let theme = null;
    if (id && mongoose.isValidObjectId(id)) {
      theme = await WebsiteTheme.findOne({ _id: id, 'meta.deletedAt': null }).lean();
    }

    const config = theme?.config || {};
    const bannerSelections = config.bannerSelections || [];
    const selectedBannerIds = new Set(bannerSelections.map((s) => String(s.bannerId?._id || s.bannerId || '')).filter(Boolean));
    const featuredSelections = config.featuredSelections || [];
    const selectedFeaturedIds = new Set(featuredSelections.map((s) => String(s.featuredId?._id || s.featuredId || '')).filter(Boolean));
    const categoryAppearances = config.categoryAppearances || [];
    const selectedCategoryIds = new Set(categoryAppearances.map((c) => String(c.categoryId?._id || c.categoryId || '')).filter(Boolean));
    const mediaOverrides = config.mediaOverrides || [];

    const [allBanners, allFeatured, allCategories] = await Promise.all([
      Banner.find({ 'meta.deletedAt': null }).lean(),
      Featured.find({ 'meta.deletedAt': null }).lean(),
      Category.find({ 'meta.deletedAt': null }).select('name slug icon banner promoBanners').lean(),
    ]);

    const items = [];
    const seenUrls = new Set();

    const extractName = (url, fallback) => {
      if (!url) return fallback;
      try {
        const parts = url.split('/');
        return parts[parts.length - 1].split('?')[0] || fallback;
      } catch {
        return fallback;
      }
    };

    allBanners.forEach((banner) => {
      const bannerId = String(banner._id);
      const isSelectedInTheme = selectedBannerIds.has(bannerId);
      const type = banner.display?.type || 'herobanner';
      const platform = banner.display?.platform || 'web';
      const title = banner.content?.title || banner.title || `${type} ${bannerId.slice(-4)}`;

      if (banner.image?.url) {
        const url = banner.image.url;
        const key = banner.image.key || '';
        const itemKey = `${bannerId}:desktop:${url}`;
        items.push({
          id: itemKey,
          url,
          key,
          name: extractName(url, `${title} (Desktop)`),
          mediaType: banner.mediaType || 'image',
          variant: platform === 'mobile' ? 'mobile' : 'desktop',
          module: 'banner',
          filterType: type === 'herobanner' ? 'hero' : type === 'collectionbanner' ? 'collection' : type === 'categorybanner' ? 'category' : type === 'mobileappbanner' ? 'app' : 'banner',
          recordId: bannerId,
          recordTitle: title,
          bannerType: type,
          platform,
          slot: 'image',
          usageLocation: `${type.toUpperCase()} · ${platform === 'mobile' ? 'Mobile App' : 'Storefront Desktop'}`,
          isUsed: isSelectedInTheme && banner.status === 'active',
          status: banner.status,
        });
        seenUrls.add(url);
      }

      if (Array.isArray(banner.collectionImages)) {
        banner.collectionImages.forEach((img, idx) => {
          if (!img?.url) return;
          const url = img.url;
          const key = img.key || '';
          const itemKey = `${bannerId}:collection:${idx}:${url}`;
          items.push({
            id: itemKey,
            url,
            key,
            name: extractName(url, `${title} - Tile ${idx + 1}`),
            mediaType: 'image',
            variant: 'desktop',
            module: 'banner',
            filterType: 'collection',
            recordId: bannerId,
            recordTitle: title,
            bannerType: type,
            platform,
            slot: `collection:${img._id || idx}`,
            usageLocation: `Collection Banner · Tile ${idx + 1}`,
            isUsed: isSelectedInTheme && banner.status === 'active',
            status: banner.status,
          });
          seenUrls.add(url);
        });
      }
    });

    allFeatured.forEach((item) => {
      const featId = String(item._id);
      const isSelectedInTheme = selectedFeaturedIds.has(featId);
      const placement = item.placement || 'Celebrate';
      const title = item.name || `${placement} Item`;

      if (item.image?.url) {
        const url = item.image.url;
        const key = item.image.key || '';
        items.push({
          id: `${featId}:${url}`,
          url,
          key,
          name: extractName(url, title),
          mediaType: 'image',
          variant: 'universal',
          module: 'featured',
          filterType: 'celebrate_gifts',
          recordId: featId,
          recordTitle: title,
          placement,
          slot: 'image',
          usageLocation: `${placement} Showcase · ${title}`,
          isUsed: isSelectedInTheme && item.status === 'active',
          status: item.status,
        });
        seenUrls.add(url);
      }
    });

    allCategories.forEach((cat) => {
      const catId = String(cat._id);
      const isSelectedInTheme = selectedCategoryIds.has(catId);
      const name = cat.name || 'Category';

      if (cat.icon?.url) {
        const url = cat.icon.url;
        items.push({
          id: `${catId}:icon:${url}`,
          url,
          key: cat.icon.key || '',
          name: extractName(url, `${name} Icon`),
          mediaType: 'image',
          variant: 'universal',
          module: 'category',
          filterType: 'category_icons',
          recordId: catId,
          recordTitle: name,
          slot: 'icon',
          usageLocation: `Category Icon · ${name}`,
          isUsed: isSelectedInTheme,
          status: 'active',
        });
        seenUrls.add(url);
      }

      if (cat.banner?.url) {
        const url = cat.banner.url;
        items.push({
          id: `${catId}:banner:${url}`,
          url,
          key: cat.banner.key || '',
          name: extractName(url, `${name} Category Banner`),
          mediaType: 'image',
          variant: 'desktop',
          module: 'category',
          filterType: 'category',
          recordId: catId,
          recordTitle: name,
          slot: 'banner',
          usageLocation: `Category Header · ${name}`,
          isUsed: true,
          status: 'active',
        });
        seenUrls.add(url);
      }
    });



    return {
      items,
      total: items.length,
      counts: {
        all: items.length,
        hero: items.filter((i) => i.filterType === 'hero').length,
        collection: items.filter((i) => i.filterType === 'collection').length,
        category: items.filter((i) => i.filterType === 'category').length,
        app: items.filter((i) => i.filterType === 'app').length,
        celebrate_gifts: items.filter((i) => i.filterType === 'celebrate_gifts').length,
        category_icons: items.filter((i) => i.filterType === 'category_icons').length,
        unused: items.filter((i) => !i.isUsed).length,
      },
    };
  }

  // ------------------------------- get public config ----------------------------
  async getPublicConfig() {
    const settings = await this.settings();
    let activeThemeId = settings.activeThemeId;

    if (!activeThemeId) {
      try {
        const storeSetting = await Setting.findOne().select('currentThemeId').lean();
        if (storeSetting?.currentThemeId) activeThemeId = storeSetting.currentThemeId;
      } catch (_) {}
    }

    if (!activeThemeId) {
      const active = await WebsiteTheme.findOne({ status: 'active', 'meta.deletedAt': null }).select('_id').lean();
      if (active) activeThemeId = active._id;
    }

    if (!activeThemeId) return { revision: settings.revision, timezone: TIMEZONE, theme: null };
    const theme = await WebsiteTheme.findOne({ _id: activeThemeId, 'meta.deletedAt': null }).lean();
    return {
      revision: settings.revision,
      timezone: TIMEZONE,
      theme: theme?.publishedSnapshot ? { ...theme.publishedSnapshot, config: await themeMedia.resolve(theme.publishedSnapshot.config) } : (theme?.config ? { id: String(theme._id), name: theme.name, code: theme.code, config: await themeMedia.resolve(theme.config) } : null),
    };
  }

  // ------------------------------- get theme publishing history ----------------------------
  async getHistory() {
    return [];
  }

  // ------------------------------- reconcile theme schedule ----------------------------
  async reconcileSchedule() {
    const settings = await this.settings();
    const now = new Date();
    if (settings.scheduledThemeId) {
      const scheduled = await WebsiteTheme.findOne({ _id: settings.scheduledThemeId, status: 'scheduled', 'meta.deletedAt': null });
      if (scheduled?.schedule?.startAt && scheduled.schedule.startAt <= now) {
        await this.setActive(scheduled, null, 'activated');
        return;
      }
    }
    if (settings.activeThemeId) {
      const active = await WebsiteTheme.findOne({ _id: settings.activeThemeId, 'meta.deletedAt': null });
      if (active?.schedule?.endAt && active.schedule.endAt <= now) {
        const fallbackId = active.schedule.fallbackThemeId || settings.previousThemeId;
        const fallback = fallbackId ? await WebsiteTheme.findOne({ _id: fallbackId, 'meta.deletedAt': null }) : null;
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
