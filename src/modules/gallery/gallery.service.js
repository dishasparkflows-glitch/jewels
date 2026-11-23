const mongoose = require('mongoose');
const { escapeRegex } = require('../../utils/string');
const Gallery = require('./gallery.model');
const Banner = require('../banner/banner.model');
const { Theme } = require('../theme/theme.model');
const ThemeMediaMapping = require('../theme/themeMediaMapping.model');
const Featured = require('../featured/featured.model');
const Category = require('../category/category.model');
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

      const themes = await Theme.find({ 'meta.deletedAt': null }).lean();
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

  // ------------------------------- get gallery lookup ----------------------------
  async getLookup(queryParams = {}) {
    const { themeId, placement, type, platform, status, search } = queryParams;
    const filter = { 'meta.deletedAt': null };

    if (themeId && themeId !== 'all') {
      if (mongoose.isValidObjectId(themeId)) {
        filter.themeId = new mongoose.Types.ObjectId(themeId);
      } else if (themeId === 'null' || themeId === 'unassigned') {
        filter.themeId = null;
      }
    }

    const targetType = type || placement;
    if (targetType && targetType !== 'all') {
      if (targetType === 'category' || targetType === 'categorybanner') {
        filter.placement = { $in: ['category', 'categorybanner'] };
      } else {
        filter.placement = targetType;
      }
    }

    if (platform && platform !== 'all') {
      if (platform === 'common') {
        filter.platform = 'common';
      } else if (platform === 'web' || platform === 'desktop') {
        filter.platform = { $in: ['web', 'desktop', 'common'] };
      } else if (platform === 'app' || platform === 'mobile') {
        filter.platform = { $in: ['app', 'mobile', 'common'] };
      }
    }

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      filter.$or = [
        { 'image.url': searchRegex },
        { 'image.key': searchRegex },
        { placement: searchRegex },
      ];
    }

    const items = await Gallery.find(filter)
      .populate('themeId', 'name status code description')
      .sort({ 'meta.createdAt': -1 })
      .lean();

    return items.map((doc) => ({
      _id: doc._id,
      id: doc._id,
      themeId: doc.themeId,
      themeName: doc.themeId?.name || null,
      placement: doc.placement,
      platform: doc.platform,
      image: doc.image,
      url: doc.image?.url || '',
      key: doc.image?.key || '',
      status: doc.status,
      linkedRecord: doc.linkedRecord,
      meta: doc.meta,
    }));
  }

  // ------------------------------- get themes lookup ----------------------------
  async getThemesLookup() {
    const themes = await Theme.find({ 'meta.deletedAt': null })
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

  // ------------------------------- normalize linkedRecord ----------------------------
  _normalizeLinkedRecord(lr, defaultModule = 'banner') {
    if (!lr) return null;
    const recordId = lr.recordId || lr.id || lr._id;
    if (!recordId || !mongoose.isValidObjectId(recordId)) return null;
    return {
      module: lr.module || defaultModule,
      recordId: new mongoose.Types.ObjectId(recordId),
    };
  }

  // ------------------------------- get banners lookup ----------------------------
  async getBannersLookup(themeId = null, type = null) {
    let theme = null;
    if (themeId && mongoose.isValidObjectId(themeId)) {
      theme = await Theme.findOne({ _id: themeId, 'meta.deletedAt': null })
        .select('_id name config.bannerSelections')
        .lean();
    }

    const filter = { 'meta.deletedAt': null };
    if (type && type !== 'all') {
      const typeAliases = {
        category: ['category', 'categorybanner'],
        categorybanner: ['category', 'categorybanner'],
        hero: ['hero', 'herobanner'],
        herobanner: ['hero', 'herobanner'],
        collection: ['collection', 'collectionbanner'],
        collectionbanner: ['collection', 'collectionbanner'],
        offer: ['offer', 'offerbanner'],
        offerbanner: ['offer', 'offerbanner'],
        mobileapp: ['mobileapp', 'mobileappbanner', 'app'],
        mobileappbanner: ['mobileapp', 'mobileappbanner', 'app'],
        bookappointbanner: ['bookappointbanner', 'appointment'],
        appointment: ['bookappointbanner', 'appointment'],
        customizebanner: ['customizebanner', 'custom'],
        custom: ['customizebanner', 'custom'],
      };

      const matchTypes = typeAliases[type] || [type];
      filter['display.type'] = { $in: matchTypes };
    }

    const banners = await Banner.find(filter)
      .select('_id content.title display image status')
      .populate('display.categoryId', 'name')
      .sort({ 'meta.createdAt': -1 })
      .limit(100)
      .lean();

    const themeBannerIds = new Set(
      (theme?.config?.bannerSelections || [])
        .map((b) => String(b.bannerId))
        .filter(Boolean)
    );

    return banners.map((b) => ({
      _id: b._id,
      title: b.content?.title || `${b.display?.type || 'banner'}`,
      type: b.display?.type || 'herobanner',
      displayType: b.display?.type || 'banner',
      platform: b.display?.platform || 'web',
      categoryName: b.display?.categoryId?.name || null,
      themeId: theme?._id || null,
      themeName: theme?.name || null,
      isSelectedInTheme: themeBannerIds.has(String(b._id)),
      status: b.status || 'active',
      image: b.image,
    }));
  }

  // ------------------------------- get featureds lookup ----------------------------
  async getFeaturedsLookup(themeId = null) {
    let theme = null;
    if (themeId && mongoose.isValidObjectId(themeId)) {
      theme = await Theme.findOne({ _id: themeId, 'meta.deletedAt': null })
        .select('_id name config.featuredSelections')
        .lean();
    }

    const filter = { 'meta.deletedAt': null };
    const items = await Featured.find(filter)
      .select('_id name display image status categoryId')
      .populate('categoryId', 'name')
      .sort({ 'display.type': 1, 'display.order': 1, name: 1 })
      .lean();

    const themeFeaturedIds = new Set(
      (theme?.config?.featuredSelections || [])
        .map((f) => String(f.featuredId || f.recordId))
        .filter(Boolean)
    );

    return items.map((f) => ({
      _id: f._id,
      title: f.name || 'Featured Item',
      name: f.name || 'Featured Item',
      type: (f.display?.type || 'Celebrate').toLowerCase(),
      displayType: f.display?.type || 'Celebrate',
      platform: f.display?.platform || 'web',
      themeId: theme?._id || null,
      themeName: theme?.name || null,
      isSelectedInTheme: themeFeaturedIds.has(String(f._id)),
      status: f.status || 'active',
      image: f.image,
      categoryName: f.categoryId?.name || null,
    }));
  }

  // ------------------------------- list gallery images ----------------------------
  async listImages(queryParams = {}) {
    await this.syncLegacyMedia();

    const {
      page = 1,
      limit = 10,
      themeId,
      type = 'all',
      placement,
      platform = 'all',
      status,
      sortBy = 'newest',
      search,
    } = queryParams;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const activeTheme = await Theme.findOne({ status: 'active', 'meta.deletedAt': null }).lean();
    const activeThemeId = activeTheme ? String(activeTheme._id) : null;

    const andConditions = [{ 'meta.deletedAt': null }];

    // Theme filter (themeId-wise filtering as defined in gallery.model.js)
    if (themeId && themeId !== 'all') {
      if (themeId === 'active') {
        andConditions.push({
          $or: [
            { themeId: activeThemeId ? new mongoose.Types.ObjectId(activeThemeId) : null },
            { themeId: null },
          ],
        });
      } else if (mongoose.isValidObjectId(themeId)) {
        andConditions.push({ themeId: new mongoose.Types.ObjectId(themeId) });
      } else if (themeId === 'null' || themeId === 'unassigned') {
        andConditions.push({ themeId: null });
      }
    }

    // Placement filter
    const targetType = type !== 'all' ? type : (placement && placement !== 'all' ? placement : null);
    if (targetType) {
      if (targetType === 'category' || targetType === 'categorybanner') {
        andConditions.push({ placement: { $in: ['category', 'categorybanner'] } });
      } else {
        andConditions.push({ placement: targetType });
      }
    }

    // Platform filter
    if (platform && platform !== 'all') {
      if (platform === 'common') {
        andConditions.push({ platform: 'common' });
      } else if (platform === 'web' || platform === 'desktop') {
        andConditions.push({ platform: { $in: ['web', 'desktop', 'common'] } });
      } else if (platform === 'app' || platform === 'mobile') {
        andConditions.push({ platform: { $in: ['app', 'mobile', 'common'] } });
      }
    }

    // Status filter
    if (status && status !== 'all') {
      andConditions.push({ status });
    }

    // LinkedRecord filter
    if (queryParams.module) {
      andConditions.push({ 'linkedRecord.module': queryParams.module });
    }
    if (queryParams.recordId && mongoose.isValidObjectId(queryParams.recordId)) {
      andConditions.push({ 'linkedRecord.recordId': new mongoose.Types.ObjectId(queryParams.recordId) });
    }

    // Search filter (searches URL, key, placement)
    if (search && search.trim()) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      andConditions.push({
        $or: [
          { 'image.url': searchRegex },
          { 'image.key': searchRegex },
          { placement: searchRegex },
        ],
      });
    }

    const filter = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];

    let sort = { 'meta.createdAt': -1 };
    if (sortBy === 'oldest') sort = { 'meta.createdAt': 1 };

    const [docs, total] = await Promise.all([
      Gallery.find(filter)
        .populate('themeId', 'name status code description')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Gallery.countDocuments(filter),
    ]);

    const countConditions = [{ 'meta.deletedAt': null }];
    if (themeId && themeId !== 'all') {
      if (themeId === 'active') {
        countConditions.push({
          $or: [
            { themeId: activeThemeId ? new mongoose.Types.ObjectId(activeThemeId) : null },
            { themeId: null },
          ],
        });
      } else if (mongoose.isValidObjectId(themeId)) {
        countConditions.push({ themeId: new mongoose.Types.ObjectId(themeId) });
      } else if (themeId === 'null' || themeId === 'unassigned') {
        countConditions.push({ themeId: null });
      }
    }
    const countFilter = countConditions.length > 1 ? { $and: countConditions } : countConditions[0];

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

    const bannerIds = docs
      .filter((d) => d.linkedRecord?.module === 'banner' && d.linkedRecord?.recordId)
      .map((d) => d.linkedRecord.recordId);

    const featuredIds = docs
      .filter((d) => d.linkedRecord?.module === 'featured' && d.linkedRecord?.recordId)
      .map((d) => d.linkedRecord.recordId);

    let bannerLookup = {};
    if (bannerIds.length > 0) {
      try {
        const banners = await Banner.find({ _id: { $in: bannerIds } })
          .select('_id content.title display image status')
          .populate('display.categoryId', 'name')
          .lean();
        bannerLookup = banners.reduce((acc, b) => {
          acc[String(b._id)] = {
            _id: b._id,
            title: b.content?.title || `${b.display?.type || 'Banner'}`,
            type: b.display?.type || 'herobanner',
            categoryName: b.display?.categoryId?.name || null,
            status: b.status,
          };
          return acc;
        }, {});
      } catch (err) {
        console.warn('Failed to populate linked banner lookup in gallery:', err.message);
      }
    }

    let featuredLookup = {};
    if (featuredIds.length > 0) {
      try {
        const featureds = await Featured.find({ _id: { $in: featuredIds } })
          .select('_id name display image status')
          .lean();
        featuredLookup = featureds.reduce((acc, f) => {
          acc[String(f._id)] = {
            _id: f._id,
            title: f.name || 'Featured Item',
            name: f.name,
            type: f.display?.type || 'Celebrate',
            status: f.status,
          };
          return acc;
        }, {});
      } catch (err) {
        console.warn('Failed to populate linked featured lookup in gallery:', err.message);
      }
    }

    const items = docs.map((doc) => ({
      _id: doc._id,
      themeId: doc.themeId || null,
      linkedRecord: doc.linkedRecord || null,
      linkedBanner: doc.linkedRecord?.recordId ? bannerLookup[String(doc.linkedRecord.recordId)] || null : null,
      linkedFeatured: doc.linkedRecord?.recordId ? featuredLookup[String(doc.linkedRecord.recordId)] || null : null,
      placement: doc.placement,
      platform: doc.platform,
      image: {
        url: doc.image?.url || '',
        key: doc.image?.key || '',
      },
      status: doc.status || 'active',
      meta: doc.meta,
    }));

    const themesLookup = await this.getThemesLookup();

    return {
      items,
      counts,
      themes: themesLookup,
      total,
      pagination: {
        ...getPaginationMeta(total, pageNum, limitNum),
        page: pageNum,
        totalItems: total,
      },
    };
  }

  // ------------------------------- get single gallery image ----------------------------
  async getOne(id) {
    if (!mongoose.isValidObjectId(id)) {
      throw new ApiError(400, 'Invalid gallery item ID');
    }
    const item = await Gallery.findOne({ _id: id, 'meta.deletedAt': null })
      .populate('themeId', 'name status code description')
      .lean();

    if (!item) {
      throw new ApiError(404, 'Gallery media item not found');
    }

    let linkedBanner = null;
    if (item.linkedRecord?.module === 'banner' && item.linkedRecord?.recordId) {
      try {
        const b = await Banner.findById(item.linkedRecord.recordId)
          .select('_id content.title display image status')
          .populate('display.categoryId', 'name')
          .lean();
        if (b) {
          linkedBanner = {
            _id: b._id,
            title: b.content?.title || `${b.display?.type || 'Banner'}`,
            type: b.display?.type || 'herobanner',
            categoryName: b.display?.categoryId?.name || null,
            status: b.status,
          };
        }
      } catch (e) {}
    }

    let linkedFeatured = null;
    if (item.linkedRecord?.module === 'featured' && item.linkedRecord?.recordId) {
      try {
        const f = await Featured.findById(item.linkedRecord.recordId)
          .select('_id name display image status')
          .lean();
        if (f) {
          linkedFeatured = {
            _id: f._id,
            title: f.name || 'Featured Item',
            name: f.name,
            type: f.display?.type || 'Celebrate',
            status: f.status,
          };
        }
      } catch (e) {}
    }

    return {
      _id: item._id,
      themeId: item.themeId || null,
      linkedRecord: item.linkedRecord || null,
      linkedBanner,
      linkedFeatured,
      placement: item.placement,
      platform: item.platform,
      image: {
        url: item.image?.url || '',
        key: item.image?.key || '',
      },
      status: item.status || 'active',
      meta: item.meta,
    };
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
      linkedRecord,
      status = 'active',
    } = payload;

    const actualPlacement = placement || type || 'herobanner';

    let theme = null;
    if (themeId && mongoose.isValidObjectId(themeId)) {
      theme = await Theme.findOne({ _id: themeId, 'meta.deletedAt': null });
      if (!theme) {
        throw new ApiError(404, 'Selected theme not found');
      }
    }

    const targetModule = actualPlacement === 'celebrate' ? 'featured' : 'banner';
    const defaultLinkedRecord = this._normalizeLinkedRecord(linkedRecord, targetModule);

    // Support both single image and multiple images batch creation
    const rawImages = Array.isArray(images) && images.length > 0
      ? images
      : (image ? [image] : []);

    const validImages = rawImages
      .map((item) => {
        if (!item) return null;
        if (typeof item === 'string') {
          return {
            url: item,
            key: '',
            linkedRecord: defaultLinkedRecord,
          };
        }
        if (item.url) {
          const itemLinkedRecord = this._normalizeLinkedRecord(item.linkedRecord, targetModule) || defaultLinkedRecord;
          return {
            url: item.url,
            key: item.key || '',
            linkedRecord: itemLinkedRecord,
          };
        }
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
        linkedRecord: single.linkedRecord || null,
        placement: actualPlacement,
        platform,
        image: { url: single.url, key: single.key || '' },
        status: status || 'active',
        meta: { createdBy: actorId, createdAt: new Date() },
      });

      // Synchronize 1 entry into theme_media_mappings if mapped to a theme and record
      if (galleryItem.themeId && galleryItem.linkedRecord?.recordId) {
        await this._syncThemeMediaMapping({
          themeId: galleryItem.themeId,
          recordId: galleryItem.linkedRecord.recordId,
          galleryId: galleryItem._id,
          status: galleryItem.status || 'active',
        });
      }

      return galleryItem;
    }

    // Multiple images: store as separate database records
    const docs = validImages.map((img) => ({
      themeId: theme?._id || null,
      linkedRecord: img.linkedRecord || null,
      placement: actualPlacement,
      platform,
      image: { url: img.url, key: img.key || '' },
      status: status || 'active',
      meta: { createdBy: actorId, createdAt: new Date() },
    }));

    const galleryItems = await Gallery.insertMany(docs);

    // Synchronize theme_media_mappings for each created gallery item with a linked record
    for (const item of galleryItems) {
      if (item.themeId && item.linkedRecord?.recordId) {
        await this._syncThemeMediaMapping({
          themeId: item.themeId,
          recordId: item.linkedRecord.recordId,
          galleryId: item._id,
          status: item.status || 'active',
        });
      }
    }

    return galleryItems;
  }

  // ------------------------------- sync theme media mapping ----------------------------
  async _syncThemeMediaMapping({ themeId, recordId, galleryId, status = 'active' }) {
    if (!themeId || !recordId || !galleryId) return;
    if (
      !mongoose.isValidObjectId(themeId) ||
      !mongoose.isValidObjectId(recordId) ||
      !mongoose.isValidObjectId(galleryId)
    ) {
      return;
    }

    try {
      await ThemeMediaMapping.findOneAndUpdate(
        {
          themeId: new mongoose.Types.ObjectId(themeId),
          recordId: new mongoose.Types.ObjectId(recordId),
        },
        {
          $set: {
            galleryId: new mongoose.Types.ObjectId(galleryId),
            status: status === 'inactive' ? 'inactive' : 'active',
          },
        },
        {
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );
    } catch (err) {
      console.warn('Failed to sync theme_media_mapping:', err.message);
    }
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

    const oldThemeId = item.themeId;
    const oldRecordId = item.linkedRecord?.recordId;

    if (data.placement !== undefined) item.placement = data.placement;
    if (data.platform !== undefined) item.platform = data.platform;
    if (data.themeId !== undefined) {
      item.themeId = data.themeId && mongoose.isValidObjectId(data.themeId) ? data.themeId : null;
    }
    if (data.status !== undefined) item.status = data.status;
    if (data.image?.url) {
      item.image = { url: data.image.url, key: data.image.key || '' };
    }
    if (data.linkedRecord !== undefined) {
      const targetModule = (data.placement || item.placement) === 'celebrate' ? 'featured' : 'banner';
      item.linkedRecord = this._normalizeLinkedRecord(data.linkedRecord, targetModule);
    }

    item.meta = {
      ...(item.meta || {}),
      updatedBy: actorId,
      updatedAt: new Date(),
    };

    await item.save();

    // If themeId or recordId changed, clean up previous mapping if needed
    if (oldThemeId && oldRecordId) {
      const isSame =
        String(item.themeId || '') === String(oldThemeId) &&
        String(item.linkedRecord?.recordId || '') === String(oldRecordId);
      if (!isSame) {
        try {
          await ThemeMediaMapping.deleteOne({
            themeId: oldThemeId,
            recordId: oldRecordId,
            galleryId: item._id,
          });
        } catch (e) {}
      }
    }

    // Sync current mapping if themeId and recordId are set
    if (item.themeId && item.linkedRecord?.recordId) {
      await this._syncThemeMediaMapping({
        themeId: item.themeId,
        recordId: item.linkedRecord.recordId,
        galleryId: item._id,
        status: item.status || 'active',
      });
    }

    return this.getOne(item._id);
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

    // Clean up mapping from theme_media_mappings when gallery asset is deleted
    try {
      await ThemeMediaMapping.deleteMany({ galleryId: id });
    } catch (err) {
      console.warn('Failed to clean up theme_media_mappings for deleted asset:', err.message);
    }

    return { message: 'Gallery item removed successfully', id };
  }
}

module.exports = new GalleryService();
