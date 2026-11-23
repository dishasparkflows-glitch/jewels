const mongoose = require('mongoose');
const ThemeMediaMapping = require('./themeMediaMapping.model');
const { Theme } = require('./theme.model');
const Setting = require('../setting/setting.model');
const Gallery = require('../gallery/gallery.model');
const Banner = require('../banner/banner.model');
const Featured = require('../featured/featured.model');
const Category = require('../category/category.model');
const ApiError = require('../../utils/ApiError');
const { getPaginationMeta } = require('../../utils/pagination');

// Supported modules metadata & normalized key resolver
const MODULES_CONFIG = {
  herobanner: {
    key: 'herobanner',
    label: 'Hero Banners',
    model: Banner,
    filter: { 'display.type': 'herobanner' },
  },
  collectionbanner: {
    key: 'collectionbanner',
    label: 'Collection Banners',
    model: Banner,
    filter: { 'display.type': 'collectionbanner' },
  },
  celebrate: {
    key: 'celebrate',
    label: 'Celebrate & Gifts',
    model: Featured,
    filter: {},
  },
  category: {
    key: 'category',
    label: 'Categories',
    model: Category,
    filter: {},
  },
  offerbanner: {
    key: 'offerbanner',
    label: 'Offer Banners',
    model: Banner,
    filter: { 'display.type': 'offerbanner' },
  },
  mobileappbanner: {
    key: 'mobileappbanner',
    label: 'App Banners',
    model: Banner,
    filter: { 'display.type': 'mobileappbanner' },
  },
  categorybanner: {
    key: 'categorybanner',
    label: 'Category Banners',
    model: Banner,
    filter: { 'display.type': { $in: ['categorybanner', 'category'] } },
  },
  bookappointbanner: {
    key: 'bookappointbanner',
    label: 'Appointment Banners',
    model: Banner,
    filter: { 'display.type': 'bookappointbanner' },
  },
  customizebanner: {
    key: 'customizebanner',
    label: 'Custom Banners',
    model: Banner,
    filter: { 'display.type': 'customizebanner' },
  },
  websitebanner: {
    key: 'websitebanner',
    label: 'Other Banners',
    model: Banner,
    filter: { 'display.type': 'websitebanner' },
  },
};

function normalizeModule(rawModule) {
  if (!rawModule) return 'herobanner';
  const m = String(rawModule).toLowerCase().trim().replace(/[-_]/g, '');
  if (m === 'herobanner' || m === 'herobanners') return 'herobanner';
  if (m === 'collectionbanner' || m === 'collectionbanners' || m === 'collections') return 'collectionbanner';
  if (m === 'celebrate' || m === 'celebrategifts' || m === 'featured' || m === 'gifts') return 'celebrate';
  if (m === 'categorybanner' || m === 'categorybanners') return 'categorybanner';
  if (m === 'category' || m === 'categories') return 'category';
  if (m === 'offerbanner' || m === 'offerbanners' || m === 'offers') return 'offerbanner';
  if (m === 'mobileappbanner' || m === 'appbanner' || m === 'appbanners' || m === 'mobileapp') return 'mobileappbanner';
  if (m === 'bookappointbanner' || m === 'appointmentbanner' || m === 'appointment' || m === 'bookappointment') return 'bookappointbanner';
  if (m === 'websitebanner' || m === 'otherbanner' || m === 'other') return 'websitebanner';
  if (m === 'customizebanner' || m === 'custombanner' || m === 'custom') return 'customizebanner';
  return m;
}

class ThemeMediaMappingService {
  // ------------------------------- get supported modules ----------------------------
  getSupportedModules() {
    return Object.values(MODULES_CONFIG).map((cfg) => ({
      key: cfg.key,
      label: cfg.label,
    }));
  }

  // ------------------------------- get module records ----------------------------
  async getModuleRecords({ themeId, module = 'herobanner', page = 1, limit = 50, search = '' }) {
    if (!mongoose.isValidObjectId(themeId)) {
      throw new ApiError(400, 'Invalid Theme ID');
    }

    const theme = await Theme.findOne({ _id: themeId, 'meta.deletedAt': null }).lean();
    if (!theme) {
      throw new ApiError(404, 'Theme not found');
    }

    const normModule = normalizeModule(module);
    const modConfig = MODULES_CONFIG[normModule] || MODULES_CONFIG.herobanner;
    const Model = modConfig.model;

    const filter = { ...modConfig.filter, 'meta.deletedAt': null };

    // Search filter
    if (search && search.trim()) {
      const term = search.trim();
      const searchRegex = { $regex: term, $options: 'i' };
      if (normModule === 'category' || normModule === 'celebrate') {
        filter.name = searchRegex;
      } else {
        filter.$or = [
          { 'content.title': searchRegex },
          { 'content.subtitle': searchRegex },
          { 'content.description': searchRegex },
        ];
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const recordQuery = Model.find(filter)
      .sort({ 'display.order': 1, order: 1, 'meta.createdAt': -1 })
      .skip(skip)
      .limit(limitNum);

    if (Model === Banner) {
      recordQuery.populate('display.categoryId', 'name slug');
      recordQuery.populate('collectionImages.categoryId', 'name slug');
    }

    const [total, rawRecords] = await Promise.all([
      Model.countDocuments(filter),
      recordQuery.lean(),
    ]);

    const recordIds = rawRecords.map((r) => r._id);
    const tileIds = [];
    rawRecords.forEach((r) => {
      if (Array.isArray(r.collectionImages)) {
        r.collectionImages.forEach((t) => {
          if (t._id) tileIds.push(t._id);
        });
      }
    });

    const allTargetIds = [...recordIds, ...tileIds];

    // Fetch existing mappings for this theme and records
    const mappings = await ThemeMediaMapping.find({
      themeId,
      recordId: { $in: allTargetIds },
      status: 'active',
    })
      .populate('galleryId')
      .lean();

    // Map by recordId
    const mappingsByRecord = new Map();
    mappings.forEach((m) => {
      const rId = String(m.recordId);
      mappingsByRecord.set(rId, m);
    });

    // Transform records for clean UI presentation
    const items = rawRecords.map((rec) => {
      const recId = String(rec._id);
      const mapping = mappingsByRecord.get(recId);
      const isMapped = Boolean(mapping);

      const gItem = mapping?.galleryId;
      const gId = gItem?._id || gItem || null;
      const mappingImageUrl = gItem?.image?.url || null;

      const mappedSlot = mapping
        ? {
            _id: mapping._id,
            galleryId: gId,
            mediaId: gId,
            imageUrl: mappingImageUrl,
            imageKey: gItem?.image?.key || null,
            status: mapping.status,
          }
        : null;

      // Determine titles & fallbacks based on module
      let title = '';
      let subtitle = '';
      let slotLabel = '';
      let targetLink = '';
      let originalDesktopImage = null;
      let originalMobileImage = null;
      let originalIcon = null;
      let originalBanner = null;

      if (normModule === 'category') {
        title = rec.name || 'Category';
        subtitle = rec.slug ? `/${rec.slug}` : '';
        slotLabel = 'Category Page & Navigation';
        originalIcon = rec.icon?.url || null;
        originalBanner = rec.banner?.url || null;
        originalDesktopImage = originalBanner || originalIcon;
        targetLink = rec.slug ? `/category/${rec.slug}` : '';
      } else if (normModule === 'celebrate') {
        title = rec.name || rec.title || 'Featured Showcase Card';
        subtitle = rec.display?.type ? `${rec.display.type} Showcase` : (rec.placement || 'Celebrate & Gifts Section');
        slotLabel = `${rec.display?.type || 'Celebrate'} Showcase Card`;
        originalDesktopImage = rec.image?.url || null;
        originalMobileImage = rec.image?.url || null;
        targetLink = rec.link || '';
      } else {
        // Banner
        const orderNum = (rec.display?.order ?? rec.order ?? 0) + 1;
        const bannerType = rec.display?.type || normModule;
        const typeLabels = {
          herobanner: 'Homepage Hero Banner',
          collectionbanner: 'Collection Showcase Banner',
          offerbanner: 'Special Offer Banner',
          mobileappbanner: 'Mobile App Download Banner',
          customizebanner: 'Custom / Bespoke Banner',
          websitebanner: 'Website General Banner',
          bookappointbanner: 'Book Appointment Banner',
        };
        const friendlyTypeName = typeLabels[bannerType] || bannerType;

        slotLabel = `${friendlyTypeName} · Slide #${orderNum}`;
        title = rec.content?.title || slotLabel;
        subtitle =
          rec.content?.subtitle && rec.content?.subtitle !== 'none'
            ? rec.content.subtitle
            : rec.display?.collectionGroup
            ? `Collection Group: ${rec.display.collectionGroup.toUpperCase()}`
            : `Storefront Display Slide #${orderNum}`;
        originalDesktopImage = rec.image?.url || null;
        originalMobileImage = rec.mobileImage?.url || rec.image?.url || null;
        targetLink = rec.link || rec.content?.link || rec.appStoreUrl || '';
      }

      // Resolve tiles for collection banner
      const tiles = Array.isArray(rec.collectionImages)
        ? [...rec.collectionImages]
            .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
            .map((tile, idx) => {
              const tileId = String(tile._id);
              const tileMapping = mappingsByRecord.get(tileId);
              const g = tileMapping?.galleryId;
              const gId = g?._id || g || null;
              const mUrl = g?.image?.url || null;

              return {
                _id: tile._id,
                bannerId: rec._id,
                order: tile.order ?? idx + 1,
                originalUrl: tile.url,
                key: tile.key,
                categoryId: tile.categoryId?._id || tile.categoryId,
                categoryName: tile.categoryId?.name || '',
                isMapped: Boolean(tileMapping),
                mappingId: tileMapping?._id || null,
                mappedImageUrl: mUrl,
                imageUrl: mUrl || tile.url,
                galleryId: gId,
                status: tileMapping?.status || 'active',
              };
            })
        : [];

      const isRecordMapped = tiles.length > 0
        ? tiles.some((t) => t.isMapped)
        : isMapped;

      const effectiveType = rec.display?.type || rec.placement || normModule;

      return {
        ...rec,
        _id: rec._id,
        title,
        subtitle,
        slotLabel,
        targetLink,
        type: effectiveType,
        placement: effectiveType,
        platform: rec.display?.platform || 'web',
        order: rec.display?.order ?? rec.order ?? 0,
        status: rec.status || 'active',
        collectionGroup: rec.display?.collectionGroup || null,
        originalDesktopImage,
        originalMobileImage,
        originalIcon,
        originalBanner,
        originalMedia: {
          desktopImageUrl: originalDesktopImage,
          mobileImageUrl: originalMobileImage,
          iconUrl: originalIcon,
          bannerUrl: originalBanner,
        },
        collectionImages: rec.collectionImages || [],
        tiles,
        isMapped: isRecordMapped,
        mappings: mappedSlot ? [mappedSlot] : [],
        desktopMapping: mappedSlot,
        mobileMapping: mappedSlot,
        iconMapping: mappedSlot,
        bannerMapping: mappedSlot,
        tileMappings: mappedSlot ? [mappedSlot] : [],
      };
    });

    // Calculate module mapping stats
    const allModRecordIds = await Model.distinct('_id', filter);
    let totalTargetCount = total;
    let mappedCount = 0;

    if (normModule === 'collectionbanner') {
      const banners = await Model.find(filter).select('collectionImages._id').lean();
      const allTileIds = [];
      banners.forEach((b) => {
        if (Array.isArray(b.collectionImages)) {
          b.collectionImages.forEach((t) => {
            if (t._id) allTileIds.push(t._id);
          });
        }
      });
      const allTargets = [...allModRecordIds, ...allTileIds];
      const mappedTargets = allTargets.length > 0
        ? await ThemeMediaMapping.distinct('recordId', {
            themeId,
            recordId: { $in: allTargets },
            status: 'active',
          })
        : [];
      if (allTileIds.length > 0) {
        totalTargetCount = allTileIds.length;
        const mappedSet = new Set(mappedTargets.map(String));
        mappedCount = allTileIds.filter((tid) => mappedSet.has(String(tid))).length;
      } else {
        totalTargetCount = allModRecordIds.length;
        mappedCount = mappedTargets.length;
      }
    } else {
      const totalModuleMapped = allModRecordIds.length > 0
        ? await ThemeMediaMapping.distinct('recordId', {
            themeId,
            recordId: { $in: allModRecordIds },
            status: 'active',
          })
        : [];
      mappedCount = totalModuleMapped.length;
    }

    const unmappedCount = Math.max(0, totalTargetCount - mappedCount);

    return {
      module: normModule,
      label: modConfig.label,
      items,
      records: items,
      total,
      pagination: getPaginationMeta(total, pageNum, limitNum),
      stats: {
        totalRecords: totalTargetCount,
        mappedRecords: mappedCount,
        unmappedRecords: unmappedCount,
        completionPercentage: totalTargetCount > 0 ? Math.round((mappedCount / totalTargetCount) * 100) : 100,
      },
    };
  }

  // ------------------------------- get theme mappings ----------------------------
  async getThemeMappings({ themeId, module = null }) {
    if (!mongoose.isValidObjectId(themeId)) {
      throw new ApiError(400, 'Invalid Theme ID');
    }

    const filter = {
      themeId,
      status: 'active',
    };

    if (module && module !== 'all') {
      const normModule = normalizeModule(module);
      const modConfig = MODULES_CONFIG[normModule];
      if (modConfig) {
        const modRecordIds = await modConfig.model.distinct('_id', { ...modConfig.filter, 'meta.deletedAt': null });
        filter.recordId = { $in: modRecordIds };
      }
    }

    const mappings = await ThemeMediaMapping.find(filter)
      .populate('galleryId')
      .lean();

    return mappings.map((m) => {
      const gItem = m.galleryId;
      const gId = gItem?._id || gItem;
      return {
        _id: m._id,
        themeId: m.themeId,
        recordId: m.recordId,
        galleryId: gId,
        status: m.status,
        image: gItem?.image || null,
        imageUrl: gItem?.image?.url || null,
        imageKey: gItem?.image?.key || null,
      };
    });
  }

  // ------------------------------- upsert theme mapping ----------------------------
  async upsertMapping({
    themeId,
    recordId,
    galleryId,
    mediaId,
    status = 'active',
  }) {
    const targetGalleryId = galleryId || mediaId;
    if (!mongoose.isValidObjectId(themeId)) throw new ApiError(400, 'Invalid Theme ID');
    if (!mongoose.isValidObjectId(recordId)) throw new ApiError(400, 'Invalid Record ID');
    if (!mongoose.isValidObjectId(targetGalleryId)) throw new ApiError(400, 'Invalid Gallery ID');

    // Verify theme exists
    const theme = await Theme.findOne({ _id: themeId, 'meta.deletedAt': null }).lean();
    if (!theme) throw new ApiError(404, 'Theme not found');

    // Verify Gallery media item exists
    const galleryAsset = await Gallery.findOne({ _id: targetGalleryId, 'meta.deletedAt': null }).lean();
    if (!galleryAsset) throw new ApiError(404, 'Gallery media asset not found');

    const filter = {
      themeId,
      recordId,
    };

    const update = {
      $set: {
        galleryId: targetGalleryId,
        status: status || 'active',
      },
    };

    const mapping = await ThemeMediaMapping.findOneAndUpdate(filter, update, {
      upsert: true,
      returnDocument: 'after',
      setDefaultsOnInsert: true,
    }).populate('galleryId');

    await Gallery.updateOne(
      { _id: targetGalleryId },
      {
        $set: {
          themeId,
          'meta.updatedAt': new Date(),
        },
      }
    );

    // If this theme is currently active, immediately sync this mapped record to banner/featureds
    try {
      const activeTheme = await Theme.findOne({ status: 'active', 'meta.deletedAt': null }).select('_id').lean();
      if (activeTheme && String(activeTheme._id) === String(themeId)) {
        await this.syncSingleMappingToRecord(recordId, galleryAsset);
        const redisClient = require('../../utils/redisClient');
        await Promise.allSettled([
          redisClient.deleteByPattern('banners:*'),
          redisClient.deleteByPattern('featured:*'),
          redisClient.deleteByPattern('categories:*'),
          redisClient.deleteByPattern('storefront:*'),
        ]);
      }
    } catch (syncErr) {
      console.warn('[upsertMapping] Sync to record error:', syncErr.message);
    }

    const gAsset = mapping.galleryId;
    const gAssetId = gAsset?._id || gAsset;

    return {
      message: 'Theme media mapping saved successfully.',
      mapping: {
        _id: mapping._id,
        themeId: mapping.themeId,
        recordId: mapping.recordId,
        galleryId: gAssetId,
        status: mapping.status,
        imageUrl: gAsset?.image?.url || null,
        imageKey: gAsset?.image?.key || null,
      },
    };
  }

  // ------------------------------- delete theme mapping ----------------------------
  async deleteMapping({ themeId, mappingId }) {
    if (!mongoose.isValidObjectId(themeId) || !mongoose.isValidObjectId(mappingId)) {
      throw new ApiError(400, 'Invalid Theme ID or Mapping ID');
    }

    const deleted = await ThemeMediaMapping.findOneAndDelete({
      _id: mappingId,
      themeId,
    });

    if (!deleted) {
      throw new ApiError(404, 'Media mapping not found');
    }

    return {
      message: 'Media mapping removed successfully. Original record and gallery asset remain intact.',
      id: mappingId,
    };
  }

  async deleteMappingByTarget({ themeId, recordId }) {
    if (!mongoose.isValidObjectId(themeId) || !mongoose.isValidObjectId(recordId)) {
      throw new ApiError(400, 'Invalid Theme ID or Record ID');
    }

    await ThemeMediaMapping.deleteMany({
      themeId,
      recordId,
    });

    return {
      message: 'Theme media mapping removed successfully.',
    };
  }

  async bulkSaveMappings({ themeId, mappings = [] }) {
    if (!mongoose.isValidObjectId(themeId)) throw new ApiError(400, 'Invalid Theme ID');
    if (!Array.isArray(mappings) || mappings.length === 0) {
      throw new ApiError(400, 'Mappings array cannot be empty');
    }

    const theme = await Theme.findOne({ _id: themeId, 'meta.deletedAt': null }).lean();
    if (!theme) throw new ApiError(404, 'Theme not found');

    const validGalleryIds = mappings
      .map((m) => m.galleryId || m.mediaId)
      .filter((id) => mongoose.isValidObjectId(id));

    // Verify all media assets exist
    const existingMedia = await Gallery.find({
      _id: { $in: validGalleryIds },
      'meta.deletedAt': null,
    })
      .select('_id')
      .lean();
    const existingMediaSet = new Set(existingMedia.map((m) => String(m._id)));

    const ops = [];
    const skipped = [];

    mappings.forEach((m, idx) => {
      const gId = m.galleryId || m.mediaId;
      if (!mongoose.isValidObjectId(m.recordId) || !existingMediaSet.has(String(gId))) {
        skipped.push({ index: idx, error: 'Invalid recordId or galleryId' });
        return;
      }

      ops.push({
        updateOne: {
          filter: {
            themeId,
            recordId: m.recordId,
          },
          update: {
            $set: {
              galleryId: gId,
              status: m.status || 'active',
            },
          },
          upsert: true,
        },
      });
    });

    let bulkResult = { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
    if (ops.length > 0) {
      bulkResult = await ThemeMediaMapping.bulkWrite(ops, { ordered: false });
    }

    // If this theme is currently active, immediately sync all mappings to records
    try {
      const activeTheme = await Theme.findOne({ status: 'active', 'meta.deletedAt': null }).select('_id').lean();
      if (activeTheme && String(activeTheme._id) === String(themeId)) {
        await this.syncThemeMappingsToRecords(themeId);
      }
    } catch (syncErr) {
      console.warn('[bulkSaveMappings] Sync to records error:', syncErr.message);
    }

    return {
      message: `Successfully processed ${ops.length} mapping(s).`,
      matchedCount: bulkResult.matchedCount,
      modifiedCount: bulkResult.modifiedCount,
      upsertedCount: bulkResult.upsertedCount,
      totalSubmitted: mappings.length,
      skippedCount: skipped.length,
      skipped,
    };
  }

  async getMappingSummary(themeId) {
    if (!mongoose.isValidObjectId(themeId)) {
      throw new ApiError(400, 'Invalid Theme ID');
    }

    const theme = await Theme.findOne({ _id: themeId, 'meta.deletedAt': null }).lean();
    if (!theme) throw new ApiError(404, 'Theme not found');

    const modules = Object.values(MODULES_CONFIG);

    const breakdown = await Promise.all(
      modules.map(async (mod) => {
        const modRecordIds = await mod.model.distinct('_id', { ...mod.filter, 'meta.deletedAt': null });
        let total = modRecordIds.length;
        let mapped = 0;

        if (mod.key === 'collectionbanner') {
          const banners = await Banner.find({ ...mod.filter, 'meta.deletedAt': null })
            .select('collectionImages._id')
            .lean();
          const tileIds = [];
          banners.forEach((b) => {
            if (Array.isArray(b.collectionImages)) {
              b.collectionImages.forEach((t) => {
                if (t._id) tileIds.push(t._id);
              });
            }
          });
          const allTargetIds = [...modRecordIds, ...tileIds];
          const mappedRecordIds = allTargetIds.length > 0
            ? await ThemeMediaMapping.distinct('recordId', {
                themeId,
                recordId: { $in: allTargetIds },
                status: 'active',
              })
            : [];
          const totalCount = tileIds.length > 0 ? tileIds.length : modRecordIds.length;
          const mappedSet = new Set(mappedRecordIds.map(String));
          const mappedCount = tileIds.length > 0
            ? tileIds.filter((tid) => mappedSet.has(String(tid))).length
            : mappedRecordIds.length;
          total = totalCount;
          mapped = mappedCount;
        } else {
          const mappedRecordIds = total > 0
            ? await ThemeMediaMapping.distinct('recordId', {
                themeId,
                recordId: { $in: modRecordIds },
                status: 'active',
              })
            : [];
          mapped = mappedRecordIds.length;
        }

        const missing = Math.max(0, total - mapped);

        return {
          module: mod.key,
          label: mod.label,
          total,
          mapped,
          missing,
          completionPercentage: total > 0 ? Math.round((mapped / total) * 100) : 100,
        };
      })
    );

    const totalRecords = breakdown.reduce((acc, b) => acc + b.total, 0);
    const mappedRecords = breakdown.reduce((acc, b) => acc + b.mapped, 0);
    const missingRecords = breakdown.reduce((acc, b) => acc + b.missing, 0);
    const overallPercentage =
      totalRecords > 0 ? Math.round((mappedRecords / totalRecords) * 100) : 100;

    return {
      theme: {
        _id: theme._id,
        name: theme.name,
        code: theme.code,
        status: theme.status,
        isLive: theme.status === 'active',
      },
      summary: {
        totalRecords,
        mappedRecords,
        missingRecords,
        completionPercentage: overallPercentage,
        isFullyMapped: missingRecords === 0,
      },
      breakdown,
    };
  }

  // ------------------------------- sync a single mapping to target record ----------------------------
  async syncSingleMappingToRecord(recordId, galleryAsset) {
    if (!recordId || !galleryAsset) return null;
    const gAsset =
      typeof galleryAsset === 'object' && galleryAsset?.image?.url
        ? galleryAsset
        : await Gallery.findById(galleryAsset).lean();

    if (!gAsset || !gAsset.image?.url) return null;

    const imageUrl = gAsset.image.url;
    const imageKey = gAsset.image.key || '';

    // 1. Check in Featured collection (featureds)
    const featured = await Featured.findById(recordId);
    if (featured) {
      featured.image = {
        url: imageUrl,
        key: imageKey,
      };
      await featured.save();
      return { model: 'Featured', id: recordId };
    }

    // 2. Check in Banner collection (banners) - primary banner
    const banner = await Banner.findById(recordId);
    if (banner) {
      banner.image = {
        url: imageUrl,
        key: imageKey,
        mediaType: banner.image?.mediaType || 'image',
      };
      // If mobileImage exists or this banner is for mobile/common, update mobileImage as well
      if (!banner.mobileImage?.url || banner.display?.platform === 'mobile' || gAsset.platform === 'app') {
        banner.mobileImage = {
          url: imageUrl,
          key: imageKey,
          mediaType: banner.mobileImage?.mediaType || 'image',
        };
      }
      await banner.save();
      return { model: 'Banner', id: recordId };
    }

    // 3. Check if recordId is a tile in Banner.collectionImages
    const bannerWithTile = await Banner.findOne({ 'collectionImages._id': recordId });
    if (bannerWithTile) {
      await Banner.updateOne(
        { 'collectionImages._id': recordId },
        {
          $set: {
            'collectionImages.$.url': imageUrl,
            'collectionImages.$.key': imageKey,
          },
        }
      );
      return { model: 'Banner.collectionImages', id: recordId };
    }

    // 4. Check in Category collection (categories)
    const category = await Category.findById(recordId);
    if (category) {
      category.banner = {
        url: imageUrl,
        key: imageKey,
      };
      await category.save();
      return { model: 'Category', id: recordId };
    }

    return null;
  }

  // ------------------------------- sync all theme mappings to records ----------------------------
  async syncThemeMappingsToRecords(themeId) {
    if (!mongoose.isValidObjectId(themeId)) return { synced: 0 };

    // 1. Take themeId wise data from theme_media_mappings
    const mappings = await ThemeMediaMapping.find({
      themeId,
      status: 'active',
    })
      .populate('galleryId')
      .lean();

    if (!mappings || mappings.length === 0) {
      return { synced: 0 };
    }

    let syncedCount = 0;
    // 2. Take one by one recordId and galleryId, check banner and featureds table, and update image fields & url
    for (const mapping of mappings) {
      const { recordId, galleryId: gAsset } = mapping;
      if (!recordId || !gAsset?.image?.url) continue;

      try {
        const synced = await this.syncSingleMappingToRecord(recordId, gAsset);
        if (synced) syncedCount++;
      } catch (err) {
        console.warn(`[syncThemeMappingsToRecords] Error syncing record ${recordId}:`, err.message);
      }
    }

    // 3. Invalidate Redis caches so storefront immediately reflects updated records
    try {
      const redisClient = require('../../utils/redisClient');
      await Promise.allSettled([
        redisClient.deleteByPattern('banners:*'),
        redisClient.deleteByPattern('featured:*'),
        redisClient.deleteByPattern('categories:*'),
        redisClient.deleteByPattern('themes:*'),
        redisClient.deleteByPattern('website-themes:*'),
        redisClient.deleteByPattern('storefront:*'),
      ]);
    } catch (cacheErr) {
      console.warn('[syncThemeMappingsToRecords] Redis cache invalidation error:', cacheErr.message);
    }

    console.log(
      `[syncThemeMappingsToRecords] Successfully synced ${syncedCount} mapped images to banner & featured tables for theme ${themeId}`
    );
    return { synced: syncedCount };
  }

  async activateTheme(themeId, actorId = null) {
    if (!mongoose.isValidObjectId(themeId)) {
      throw new ApiError(400, 'Invalid Theme ID');
    }

    const theme = await Theme.findOne({ _id: themeId, 'meta.deletedAt': null });
    if (!theme) throw new ApiError(404, 'Theme not found');
    if (theme.status === 'archived') {
      throw new ApiError(409, 'Cannot activate an archived theme. Please duplicate or restore it first.');
    }

    const summary = await this.getMappingSummary(themeId);

    // Atomic update of storefront settings
    const previousActive = await Theme.findOne({ status: 'active', 'meta.deletedAt': null });
    const prevId = previousActive ? previousActive._id : null;

    const updatedSettings = await Setting.findOneAndUpdate(
      { 'meta.deletedAt': null },
      {
        $set: {
          currentThemeId: theme._id,
        },
      },
      { returnDocument: 'after' }
    );

    // Deactivate all previously active themes
    await Theme.updateMany(
      { status: 'active', _id: { $ne: theme._id } },
      { $set: { status: 'draft' } }
    );

    theme.status = 'active';
    theme.publishedAt = new Date();
    theme.schedule = theme.schedule || {};
    theme.schedule.startAt = null;
    if (actorId) {
      theme.meta = theme.meta || {};
      theme.meta.updatedBy = actorId;
    }
    await theme.save();

    // Take theme_media_mappings by themeId, iterate recordId, check banner and featureds table, and update image fields & URL
    const syncResult = await this.syncThemeMappingsToRecords(theme._id);

    return {
      message: `Theme "${theme.name}" activated successfully! Storefront is now using this theme.`,
      theme: {
        _id: theme._id,
        name: theme.name,
        code: theme.code,
        status: theme.status,
      },
      revision: updatedSettings?.revision || 1,
      summary: summary.summary,
      syncedMediaCount: syncResult.synced,
    };
  }

  async resolveRecordsForStorefront(module, records, activeThemeId = null) {
    if (!records || (Array.isArray(records) && records.length === 0)) {
      return records;
    }

    const normModule = normalizeModule(module);

    let themeId = activeThemeId;
    if (!themeId) {
      const settings = await Setting.findOne({ 'meta.deletedAt': null }).select('currentThemeId').lean();
      themeId = settings?.currentThemeId;
    }

    if (!themeId) {
      return records;
    }

    const isArray = Array.isArray(records);
    const recordList = isArray ? records : [records];
    const recordIds = recordList.map((r) => r._id).filter(Boolean);
    const tileIds = [];
    recordList.forEach((r) => {
      if (Array.isArray(r.collectionImages)) {
        r.collectionImages.forEach((t) => {
          if (t._id) tileIds.push(t._id);
        });
      }
    });

    const allTargetIds = [...recordIds, ...tileIds];
    if (allTargetIds.length === 0) return records;

    const mappings = await ThemeMediaMapping.find({
      themeId,
      recordId: { $in: allTargetIds },
      status: 'active',
    })
      .populate('galleryId')
      .lean();

    if (mappings.length === 0) return records;

    const mapByRecord = new Map();
    mappings.forEach((m) => {
      mapByRecord.set(String(m.recordId), m);
    });

    const resolved = recordList.map((item) => {
      const rId = String(item._id);
      const mapping = mapByRecord.get(rId);

      const clone = { ...item };
      let hasThemeOverride = false;

      // Map individual collectionImages tiles if any
      if (Array.isArray(clone.collectionImages) && clone.collectionImages.length > 0) {
        clone.collectionImages = clone.collectionImages.map((tile) => {
          const tId = String(tile._id);
          const tMap = mapByRecord.get(tId);
          if (tMap?.galleryId?.image?.url) {
            hasThemeOverride = true;
            return {
              ...tile,
              url: tMap.galleryId.image.url,
              key: tMap.galleryId.image.key || '',
              isThemeMedia: true,
            };
          }
          return tile;
        });
      }

      if (mapping) {
        const gAsset = mapping.galleryId;
        const img = gAsset?.image;
        if (img?.url) {
          hasThemeOverride = true;
          if (normModule === 'category') {
            clone.banner = {
              url: img.url,
              key: img.key || '',
            };
          } else if (normModule === 'celebrate') {
            clone.image = {
              url: img.url,
              key: img.key || '',
            };
          } else {
            clone.image = {
              url: img.url,
              key: img.key || '',
            };
            if (!clone.mobileImage || clone.mobileImage.url) {
              clone.mobileImage = {
                url: img.url,
                key: img.key || '',
              };
            }
          }
        }
      }

      if (hasThemeOverride) {
        clone.isThemeMedia = true;
      }

      return clone;
    });

    return isArray ? resolved : resolved[0];
  }
}

module.exports = new ThemeMediaMappingService();
