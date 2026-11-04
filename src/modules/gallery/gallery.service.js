const mongoose = require('mongoose');
const Gallery = require('./gallery.model');
const Banner = require('../banner/banner.model');
const { WebsiteTheme } = require('../websiteTheme/websiteTheme.model');
const Featured = require('../featured/featured.model');
const ApiError = require('../../utils/ApiError');
const { getPaginationMeta } = require('../../utils/pagination');

class GalleryService {
  // ------------------------------- get type label ----------------------------
  _getTypeLabel(type) {
    const map = {
      herobanner: 'Hero Banner',
      collectionbanner: 'Collection Banner',
      categorybanner: 'Category Banner',
      offerbanner: 'Offer Banner',
      celebrate: 'Celebrate & Gifts',
      mobileappbanner: 'Mobile App Banner',
      bookappointbanner: 'Appointment Banner',
      customizebanner: 'Custom Banner',
      websitebanner: 'Website Banner',
      asset: 'Media Library Asset',
    };
    return map[type] || 'Storefront Media';
  }

  // ------------------------------- sync legacy media ----------------------------
  async syncLegacyMedia() {
    try {
      const count = await Gallery.countDocuments({ 'meta.deletedAt': null });
      if (count > 0) return;

      const themes = await WebsiteTheme.find({ 'meta.deletedAt': null }).lean();
      const activeTheme = themes.find((t) => t.status === 'active');
      const activeThemeId = activeTheme?._id || null;

      const banners = await Banner.find({ 'meta.deletedAt': null }).lean();
      const galleryDocs = [];

      for (const b of banners) {
        const bType = b.display?.type || 'herobanner';
        const bPlatform = b.display?.platform || 'common';
        const bThemeId = b.themeId || activeThemeId;

        if (b.display?.type === 'collectionbanner' && Array.isArray(b.collectionImages)) {
          b.collectionImages.forEach((img) => {
            if (!img?.url) return;
            galleryDocs.push({
              themeId: bThemeId,
              placement: 'collectionbanner',
              platform: bPlatform,
              image: { url: img.url, key: img.key || '' },
              status: b.status || 'active',
            });
          });
        } else {
          if (b.image?.url) {
            galleryDocs.push({
              themeId: bThemeId,
              placement: bType,
              platform: bPlatform === 'mobile' ? 'app' : bPlatform,
              image: { url: b.image.url, key: b.image.key || '' },
              status: b.status || 'active',
            });
          }
          if (b.mobileImage?.url && b.mobileImage.url !== b.image?.url) {
            galleryDocs.push({
              themeId: bThemeId,
              placement: bType,
              platform: 'app',
              image: { url: b.mobileImage.url, key: b.mobileImage.key || '' },
              status: b.status || 'active',
            });
          }
        }
      }

      const featured = await Featured.find({ 'meta.deletedAt': null }).lean();
      for (const feat of featured) {
        if (feat.image?.url) {
          galleryDocs.push({
            themeId: activeThemeId,
            placement: 'celebrate',
            platform: 'web',
            image: { url: feat.image.url, key: feat.image.key || '' },
            status: feat.status || 'active',
          });
        }
      }

      if (galleryDocs.length > 0) {
        await Gallery.insertMany(galleryDocs);
      }
    } catch (err) {
      console.warn('Legacy media sync note:', err.message);
    }
  }

  // ------------------------------- get themes lookup ----------------------------
  async getThemesLookup() {
    const themes = await WebsiteTheme.find({ 'meta.deletedAt': null })
      .select('_id name code status config.bannerSelections schedule')
      .sort({ status: 1, 'meta.createdAt': -1 })
      .lean();

    return themes.map((theme) => ({
      _id: theme._id,
      name: theme.name,
      code: theme.code,
      status: theme.status,
      isLive: theme.status === 'active',
      bannerCount: (theme.config?.bannerSelections || []).length,
    }));
  }

  // ------------------------------- get banners lookup ----------------------------
  async getBannersLookup(themeId = null, type = null) {
    const filter = { 'meta.deletedAt': null };
    if (type && type !== 'all') {
      filter['display.type'] = type;
    }
    if (themeId && mongoose.isValidObjectId(themeId)) {
      filter.themeId = themeId;
    }

    const banners = await Banner.find(filter)
      .select('_id content.title display image status themeId')
      .populate('themeId', 'name status')
      .sort({ 'meta.createdAt': -1 })
      .limit(100)
      .lean();

    return banners.map((b) => ({
      _id: b._id,
      title: b.content?.title || `${b.display?.type || 'banner'}`,
      type: b.display?.type || 'herobanner',
      platform: b.display?.platform || 'web',
      themeId: b.themeId?._id || b.themeId || null,
      themeName: b.themeId?.name || null,
      status: b.status || 'active',
      image: b.image,
    }));
  }

  // ------------------------------- list gallery images ----------------------------
  async listImages(queryParams = {}) {
    await this.syncLegacyMedia();

    const {
      page = 1,
      limit = 24,
      themeId,
      type = 'all',
      placement,
      platform = 'all',
      status,
      sortBy = 'newest',
    } = queryParams;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 24));
    const skip = (pageNum - 1) * limitNum;

    const activeTheme = await WebsiteTheme.findOne({ status: 'active', 'meta.deletedAt': null }).lean();
    const activeThemeId = activeTheme ? String(activeTheme._id) : null;

    const filter = { 'meta.deletedAt': null };

    // Theme filter
    if (themeId && themeId !== 'all') {
      if (themeId === 'active') {
        filter.$or = [{ themeId: activeThemeId }, { themeId: null }];
      } else if (mongoose.isValidObjectId(themeId)) {
        filter.themeId = themeId;
      } else if (themeId === 'null' || themeId === 'unassigned') {
        filter.themeId = null;
      }
    }

    // Placement filter
    const targetType = type !== 'all' ? type : (placement && placement !== 'all' ? placement : null);
    if (targetType) {
      filter.placement = targetType;
    }

    // Platform filter
    if (platform && platform !== 'all') {
      if (platform === 'common') {
        filter.platform = 'common';
      } else if (platform === 'web' || platform === 'desktop') {
        filter.platform = { $in: ['web', 'desktop', 'common'] };
      } else if (platform === 'app' || platform === 'mobile') {
        filter.platform = { $in: ['app', 'mobile', 'common'] };
      }
    }

    // Status filter
    if (status && status !== 'all') {
      filter.status = status;
    }

    let sort = { 'meta.createdAt': -1 };
    if (sortBy === 'oldest') sort = { 'meta.createdAt': 1 };

    const [docs, total] = await Promise.all([
      Gallery.find(filter)
        .populate('themeId', 'name status code isLive')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Gallery.countDocuments(filter),
    ]);

    const countFilter = { 'meta.deletedAt': null };
    if (themeId && themeId !== 'all') {
      if (themeId === 'active') {
        countFilter.$or = [{ themeId: activeThemeId }, { themeId: null }];
      } else if (mongoose.isValidObjectId(themeId)) {
        countFilter.themeId = themeId;
      }
    }

    const allDocsForCounts = await Gallery.find(countFilter).select('placement').lean();
    const counts = {
      total: allDocsForCounts.length,
      herobanner: 0,
      collectionbanner: 0,
      categorybanner: 0,
      offerbanner: 0,
      celebrate: 0,
      mobileappbanner: 0,
      bookappointbanner: 0,
      customizebanner: 0,
      asset: 0,
    };

    allDocsForCounts.forEach((doc) => {
      const p = doc.placement || 'asset';
      if (counts[p] !== undefined) {
        counts[p]++;
      }
    });

    const items = docs.map((doc) => {
      const themeObj = doc.themeId;
      const isLive = themeObj?.status === 'active' || String(themeObj?._id) === activeThemeId;
      const url = doc.image?.url || '';
      const key = doc.image?.key || '';

      return {
        id: String(doc._id),
        _id: doc._id,
        url,
        key,
        placement: doc.placement,
        type: doc.placement,
        typeLabel: this._getTypeLabel(doc.placement),
        platform: doc.platform,
        themeId: themeObj?._id ? String(themeObj._id) : null,
        themeName: themeObj?.name || 'Global / Unassigned',
        themeStatus: themeObj?.status || null,
        isThemeLive: isLive,
        status: doc.status || 'active',
        createdAt: doc.meta?.createdAt || doc.createdAt,
        updatedAt: doc.meta?.updatedAt || doc.updatedAt,
      };
    });

    const themesLookup = await this.getThemesLookup();

    return {
      items,
      counts,
      themes: themesLookup,
      total,
      pagination: getPaginationMeta(total, pageNum, limitNum),
    };
  }

  // ------------------------------- get single gallery image ----------------------------
  async getOne(id) {
    if (!mongoose.isValidObjectId(id)) {
      throw new ApiError(400, 'Invalid gallery item ID');
    }
    const item = await Gallery.findOne({ _id: id, 'meta.deletedAt': null })
      .populate('themeId', 'name status code')
      .lean();

    if (!item) {
      throw new ApiError(404, 'Gallery media item not found');
    }
    return item;
  }

  // ------------------------------- create gallery media ----------------------------
  async create(payload, actorId = null) {
    const {
      themeId,
      placement,
      type,
      platform = 'common',
      image,
      images,
      status = 'active',
    } = payload;

    const actualPlacement = placement || type || 'herobanner';

    let theme = null;
    if (themeId && mongoose.isValidObjectId(themeId)) {
      theme = await WebsiteTheme.findOne({ _id: themeId, 'meta.deletedAt': null });
      if (!theme) {
        throw new ApiError(404, 'Selected website theme not found');
      }
    }

    // Support both single image and multiple images batch creation
    const rawImages = Array.isArray(images) && images.length > 0
      ? images
      : (image ? [image] : []);

    const validImages = rawImages
      .map((item) => {
        if (!item) return null;
        if (typeof item === 'string') return { url: item, key: '' };
        if (item.url) return { url: item.url, key: item.key || '' };
        return null;
      })
      .filter(Boolean);

    if (validImages.length === 0) {
      throw new ApiError(400, 'At least one valid image is required');
    }

    if (validImages.length === 1) {
      const single = validImages[0];
      const galleryItem = await Gallery.create({
        themeId: theme?._id || null,
        placement: actualPlacement,
        platform,
        image: { url: single.url, key: single.key || '' },
        status: status || 'active',
        meta: { createdBy: actorId, createdAt: new Date() },
      });
      return galleryItem;
    }

    // Multiple images: store as separate database records
    const docs = validImages.map((img) => ({
      themeId: theme?._id || null,
      placement: actualPlacement,
      platform,
      image: { url: img.url, key: img.key || '' },
      status: status || 'active',
      meta: { createdBy: actorId, createdAt: new Date() },
    }));

    const galleryItems = await Gallery.insertMany(docs);
    return galleryItems;
  }

  // ------------------------------- upload and assign media ----------------------------
  async uploadAndAssign(payload, actorId = null) {
    return this.create(payload, actorId);
  }

  // ------------------------------- update gallery item ----------------------------
  async update(id, data, actorId = null) {
    if (!mongoose.isValidObjectId(id)) {
      throw new ApiError(400, 'Invalid gallery item ID');
    }

    const item = await Gallery.findOne({ _id: id, 'meta.deletedAt': null });
    if (!item) {
      throw new ApiError(404, 'Gallery item not found');
    }

    if (data.placement !== undefined) item.placement = data.placement;
    if (data.platform !== undefined) item.platform = data.platform;
    if (data.themeId !== undefined) {
      item.themeId = data.themeId && mongoose.isValidObjectId(data.themeId) ? data.themeId : null;
    }
    if (data.status !== undefined) item.status = data.status;
    if (data.image?.url) {
      item.image = { url: data.image.url, key: data.image.key || '' };
    }

    item.meta = {
      ...(item.meta || {}),
      updatedBy: actorId,
      updatedAt: new Date(),
    };

    await item.save();
    return item;
  }

  // ------------------------------- toggle gallery status ----------------------------
  async toggleStatus(id, actorId = null) {
    const item = await this.getOne(id);
    const nextStatus = item.status === 'active' ? 'inactive' : 'active';
    return this.update(id, { status: nextStatus }, actorId);
  }

  // ------------------------------- delete gallery item ----------------------------
  async deleteItem(id, queryParams = {}, actorId = null) {
    if (!mongoose.isValidObjectId(id)) {
      throw new ApiError(400, 'Invalid gallery item ID');
    }

    const item = await Gallery.findOneAndUpdate(
      { _id: id },
      { $set: { 'meta.deletedAt': new Date(), 'meta.updatedBy': actorId } },
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'Gallery media item not found');
    }

    return { message: 'Gallery item removed successfully', id };
  }
}

module.exports = new GalleryService();
