const mongoose = require('mongoose');
const ThemeMediaMapping = require('./themeMediaMapping.model');
const { WebsiteTheme, WebsiteThemeSettings } = require('./websiteTheme.model');
const Gallery = require('../gallery/gallery.model');
const Banner = require('../banner/banner.model');
const Featured = require('../featured/featured.model');
const Category = require('../category/category.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

// Supported modules metadata & normalized key resolver
const MODULES_CONFIG = {
  herobanner: {
    key: 'herobanner',
    label: 'Hero Banners',
    model: Banner,
    filter: { 'display.type': 'herobanner' },
    hasDeviceVariant: true,
  },
  collectionbanner: {
    key: 'collectionbanner',
    label: 'Collection Banners',
    model: Banner,
    filter: { 'display.type': 'collectionbanner' },
    hasDeviceVariant: true,
    hasTiles: true,
  },
  celebrate: {
    key: 'celebrate',
    label: 'Celebrate & Gifts',
    model: Featured,
    filter: {},
    hasDeviceVariant: false,
  },
  category: {
    key: 'category',
    label: 'Categories',
    model: Category,
    filter: {},
    hasCategoryPlacements: true, // icon & banner
  },
  offerbanner: {
    key: 'offerbanner',
    label: 'Offer Banners',
    model: Banner,
    filter: { 'display.type': 'offerbanner' },
    hasDeviceVariant: true,
  },
  mobileappbanner: {
    key: 'mobileappbanner',
    label: 'App Banners',
    model: Banner,
    filter: { 'display.type': 'mobileappbanner' },
    hasDeviceVariant: true,
  },
  customizebanner: {
    key: 'customizebanner',
    label: 'Custom & Other Banners',
    model: Banner,
    filter: {
      'display.type': {
        $in: ['customizebanner', 'bookappointbanner', 'websitebanner'],
      },
    },
    hasDeviceVariant: true,
  },
};

function normalizeModule(rawModule) {
  if (!rawModule) return 'herobanner';
  const m = String(rawModule).toLowerCase().trim().replace(/[-_]/g, '');
  if (m === 'herobanner' || m === 'herobanners') return 'herobanner';
  if (m === 'collectionbanner' || m === 'collectionbanners' || m === 'collections') return 'collectionbanner';
  if (m === 'celebrate' || m === 'celebrategifts' || m === 'featured' || m === 'gifts') return 'celebrate';
  if (m === 'category' || m === 'categories') return 'category';
  if (m === 'offerbanner' || m === 'offerbanners' || m === 'offers') return 'offerbanner';
  if (m === 'mobileappbanner' || m === 'appbanner' || m === 'appbanners' || m === 'mobileapp') return 'mobileappbanner';
  if (m === 'customizebanner' || m === 'otherbanner' || m === 'otherbanners' || m === 'other') return 'customizebanner';
  return m;
}

class ThemeMediaMappingService {
  /**
   * Get list of module tabs with counts for the theme
   */
  getSupportedModules() {
    return Object.values(MODULES_CONFIG).map((cfg) => ({
      key: cfg.key,
      label: cfg.label,
      hasDeviceVariant: Boolean(cfg.hasDeviceVariant),
      hasTiles: Boolean(cfg.hasTiles),
      hasCategoryPlacements: Boolean(cfg.hasCategoryPlacements),
    }));
  }

  /**
   * 1. Get module records with their mapping status for a selected theme
   */
  async getModuleRecords({ themeId, module = 'herobanner', page = 1, limit = 50, search = '' }) {
    if (!mongoose.isValidObjectId(themeId)) {
      throw new ApiError(400, 'Invalid Theme ID');
    }

    const theme = await WebsiteTheme.findOne({ _id: themeId, 'meta.deletedAt': null }).lean();
    if (!theme) {
      throw new ApiError(404, 'Website theme not found');
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

    const [total, rawRecords] = await Promise.all([
      Model.countDocuments(filter),
      Model.find(filter)
        .sort({ 'display.order': 1, order: 1, 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    const recordIds = rawRecords.map((r) => r._id);

    // Fetch existing mappings for this theme and module
    const mappings = await ThemeMediaMapping.find({
      themeId,
      module: normModule,
      recordId: { $in: recordIds },
      status: 'active',
      'meta.deletedAt': null,
    })
      .populate('mediaId')
      .lean();

    // Group mappings by recordId
    const mappingsByRecord = new Map();
    mappings.forEach((m) => {
      const rId = String(m.recordId);
      if (!mappingsByRecord.has(rId)) {
        mappingsByRecord.set(rId, []);
      }
      mappingsByRecord.get(rId).push(m);
    });

    // Transform records for clean UI presentation
    const items = rawRecords.map((rec) => {
      const recId = String(rec._id);
      const recMappings = mappingsByRecord.get(recId) || [];

      // Identify placement / device mappings
      const desktopMapping = recMappings.find(
        (m) =>
          ((m.device === 'desktop' || m.device === 'common') && m.placement === 'primary') ||
          m.device === 'desktop'
      );
      const mobileMapping = recMappings.find(
        (m) => m.device === 'mobile' || m.placement === 'mobile'
      );
      const iconMapping = recMappings.find((m) => m.placement === 'icon');
      const bannerMapping = recMappings.find((m) => m.placement === 'banner');

      // For collection banners with tiles
      const tileMappings = recMappings.filter((m) => String(m.placement || '').startsWith('tile:'));

      const isMapped = recMappings.length > 0;

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
        subtitle = rec.placement || 'Celebrate & Gifts Section';
        slotLabel = 'Homepage Celebrate Card';
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
            : rec.display?.position
            ? `Position: ${rec.display.position}`
            : `Storefront Display Slide #${orderNum}`;
        originalDesktopImage = rec.image?.url || null;
        originalMobileImage = rec.mobileImage?.url || rec.image?.url || null;
        targetLink = rec.link || rec.content?.link || rec.appStoreUrl || '';
      }

      return {
        _id: rec._id,
        title,
        subtitle,
        slotLabel,
        targetLink,
        type: rec.display?.type || rec.placement || normModule,
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
        isMapped,
        mappings: recMappings.map((m) => ({
          _id: m._id,
          device: m.device,
          placement: m.placement,
          mediaId: m.mediaId?._id || m.mediaId,
          imageUrl: m.mediaId?.image?.url || null,
          imageKey: m.mediaId?.image?.key || null,
          status: m.status,
          createdAt: m.createdAt,
        })),
        desktopMapping: desktopMapping
          ? {
              _id: desktopMapping._id,
              mediaId: desktopMapping.mediaId?._id || desktopMapping.mediaId,
              imageUrl: desktopMapping.mediaId?.image?.url || null,
              device: desktopMapping.device,
              placement: desktopMapping.placement,
            }
          : null,
        mobileMapping: mobileMapping
          ? {
              _id: mobileMapping._id,
              mediaId: mobileMapping.mediaId?._id || mobileMapping.mediaId,
              imageUrl: mobileMapping.mediaId?.image?.url || null,
              device: mobileMapping.device,
              placement: mobileMapping.placement,
            }
          : null,
        iconMapping: iconMapping
          ? {
              _id: iconMapping._id,
              mediaId: iconMapping.mediaId?._id || iconMapping.mediaId,
              imageUrl: iconMapping.mediaId?.image?.url || null,
              placement: 'icon',
            }
          : null,
        bannerMapping: bannerMapping
          ? {
              _id: bannerMapping._id,
              mediaId: bannerMapping.mediaId?._id || bannerMapping.mediaId,
              imageUrl: bannerMapping.mediaId?.image?.url || null,
              placement: 'banner',
            }
          : null,
        tileMappings: tileMappings.map((tm) => ({
          _id: tm._id,
          mediaId: tm.mediaId?._id || tm.mediaId,
          imageUrl: tm.mediaId?.image?.url || null,
          placement: tm.placement,
        })),
      };
    });

    // Calculate module mapping stats
    const totalModuleMapped = await ThemeMediaMapping.distinct('recordId', {
      themeId,
      module: normModule,
      status: 'active',
      'meta.deletedAt': null,
    });

    const mappedCount = totalModuleMapped.length;
    const unmappedCount = Math.max(0, total - mappedCount);

    return {
      module: normModule,
      label: modConfig.label,
      items,
      records: items,
      total,
      pagination: getPaginationMeta(total, pageNum, limitNum),
      stats: {
        totalRecords: total,
        mappedRecords: mappedCount,
        unmappedRecords: unmappedCount,
        completionPercentage: total > 0 ? Math.round((mappedCount / total) * 100) : 100,
      },
    };
  }

  /**
   * 2. Get all mappings for a theme
   */
  async getThemeMappings({ themeId, module = null }) {
    if (!mongoose.isValidObjectId(themeId)) {
      throw new ApiError(400, 'Invalid Theme ID');
    }

    const filter = {
      themeId,
      status: 'active',
      'meta.deletedAt': null,
    };

    if (module && module !== 'all') {
      filter.module = normalizeModule(module);
    }

    const mappings = await ThemeMediaMapping.find(filter)
      .populate('mediaId')
      .sort({ 'meta.createdAt': -1 })
      .lean();

    return mappings.map((m) => ({
      _id: m._id,
      themeId: m.themeId,
      module: m.module,
      recordId: m.recordId,
      mediaId: m.mediaId?._id || m.mediaId,
      device: m.device,
      placement: m.placement,
      status: m.status,
      image: m.mediaId?.image || null,
      imageUrl: m.mediaId?.image?.url || null,
      imageKey: m.mediaId?.image?.key || null,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));
  }

  /**
   * 3. Create or update (upsert) a single mapping
   */
  async upsertMapping({
    themeId,
    module,
    recordId,
    mediaId,
    device = 'common',
    placement = 'primary',
    status = 'active',
    userId = null,
  }) {
    if (!mongoose.isValidObjectId(themeId)) throw new ApiError(400, 'Invalid Theme ID');
    if (!mongoose.isValidObjectId(recordId)) throw new ApiError(400, 'Invalid Record ID');
    if (!mongoose.isValidObjectId(mediaId)) throw new ApiError(400, 'Invalid Media ID');

    const normModule = normalizeModule(module);

    // Verify theme exists
    const theme = await WebsiteTheme.findOne({ _id: themeId, 'meta.deletedAt': null }).lean();
    if (!theme) throw new ApiError(404, 'Theme not found');

    // Verify Gallery media item exists
    const galleryAsset = await Gallery.findOne({ _id: mediaId, 'meta.deletedAt': null }).lean();
    if (!galleryAsset) throw new ApiError(404, 'Gallery media asset not found');

    const cleanDevice = ['desktop', 'mobile', 'app', 'common'].includes(device)
      ? device
      : 'common';
    const cleanPlacement = placement ? String(placement).trim() : 'primary';

    const filter = {
      themeId,
      module: normModule,
      recordId,
      placement: cleanPlacement,
      device: cleanDevice,
    };

    const update = {
      $set: {
        mediaId,
        status: status || 'active',
        'meta.updatedBy': userId,
        'meta.updatedAt': new Date(),
        'meta.deletedAt': null,
        'meta.deletedBy': null,
      },
      $setOnInsert: {
        'meta.createdBy': userId,
        'meta.createdAt': new Date(),
      },
    };

    const mapping = await ThemeMediaMapping.findOneAndUpdate(filter, update, {
      upsert: true,
      returnDocument: 'after',
      setDefaultsOnInsert: true,
    }).populate('mediaId');

    return {
      message: 'Theme media mapping saved successfully.',
      mapping: {
        _id: mapping._id,
        themeId: mapping.themeId,
        module: mapping.module,
        recordId: mapping.recordId,
        mediaId: mapping.mediaId?._id || mapping.mediaId,
        device: mapping.device,
        placement: mapping.placement,
        status: mapping.status,
        imageUrl: mapping.mediaId?.image?.url || null,
        imageKey: mapping.mediaId?.image?.key || null,
      },
    };
  }

  /**
   * 4. Delete a single mapping by ID
   */
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

  /**
   * 5. Delete mapping by compound target (module, recordId, device, placement)
   */
  async deleteMappingByTarget({ themeId, module, recordId, device = 'common', placement = 'primary' }) {
    if (!mongoose.isValidObjectId(themeId) || !mongoose.isValidObjectId(recordId)) {
      throw new ApiError(400, 'Invalid Theme ID or Record ID');
    }

    const normModule = normalizeModule(module);
    const filter = {
      themeId,
      module: normModule,
      recordId,
      placement: placement || 'primary',
      device: device || 'common',
    };

    await ThemeMediaMapping.deleteMany(filter);

    return {
      message: 'Theme media mapping removed successfully.',
    };
  }

  /**
   * 6. Bulk save mappings using bulkWrite
   */
  async bulkSaveMappings({ themeId, mappings = [], userId = null }) {
    if (!mongoose.isValidObjectId(themeId)) throw new ApiError(400, 'Invalid Theme ID');
    if (!Array.isArray(mappings) || mappings.length === 0) {
      throw new ApiError(400, 'Mappings array cannot be empty');
    }

    const theme = await WebsiteTheme.findOne({ _id: themeId, 'meta.deletedAt': null }).lean();
    if (!theme) throw new ApiError(404, 'Theme not found');

    const validMediaIds = mappings
      .map((m) => m.mediaId)
      .filter((id) => mongoose.isValidObjectId(id));

    // Verify all media assets exist
    const existingMedia = await Gallery.find({
      _id: { $in: validMediaIds },
      'meta.deletedAt': null,
    })
      .select('_id')
      .lean();
    const existingMediaSet = new Set(existingMedia.map((m) => String(m._id)));

    const ops = [];
    const skipped = [];

    mappings.forEach((m, idx) => {
      if (!mongoose.isValidObjectId(m.recordId) || !existingMediaSet.has(String(m.mediaId))) {
        skipped.push({ index: idx, error: 'Invalid recordId or mediaId' });
        return;
      }

      const normMod = normalizeModule(m.module);
      const cleanDevice = ['desktop', 'mobile', 'app', 'common'].includes(m.device)
        ? m.device
        : 'common';
      const cleanPlacement = m.placement ? String(m.placement).trim() : 'primary';

      ops.push({
        updateOne: {
          filter: {
            themeId,
            module: normMod,
            recordId: m.recordId,
            placement: cleanPlacement,
            device: cleanDevice,
          },
          update: {
            $set: {
              mediaId: m.mediaId,
              status: m.status || 'active',
              'meta.updatedBy': userId,
              'meta.updatedAt': new Date(),
              'meta.deletedAt': null,
              'meta.deletedBy': null,
            },
            $setOnInsert: {
              'meta.createdBy': userId,
              'meta.createdAt': new Date(),
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

  /**
   * 7. Comprehensive summary of theme mappings across all modules
   */
  async getMappingSummary(themeId) {
    if (!mongoose.isValidObjectId(themeId)) {
      throw new ApiError(400, 'Invalid Theme ID');
    }

    const theme = await WebsiteTheme.findOne({ _id: themeId, 'meta.deletedAt': null }).lean();
    if (!theme) throw new ApiError(404, 'Theme not found');

    const modules = Object.values(MODULES_CONFIG);

    const breakdown = await Promise.all(
      modules.map(async (mod) => {
        const [total, mappedRecordIds] = await Promise.all([
          mod.model.countDocuments({ ...mod.filter, 'meta.deletedAt': null }),
          ThemeMediaMapping.distinct('recordId', {
            themeId,
            module: mod.key,
            status: 'active',
            'meta.deletedAt': null,
          }),
        ]);

        const mapped = mappedRecordIds.length;
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

  /**
   * 8. One-click theme activation with mapping validation
   */
  async activateTheme(themeId, actorId = null) {
    if (!mongoose.isValidObjectId(themeId)) {
      throw new ApiError(400, 'Invalid Theme ID');
    }

    const theme = await WebsiteTheme.findOne({ _id: themeId, 'meta.deletedAt': null });
    if (!theme) throw new ApiError(404, 'Theme not found');
    if (theme.status === 'archived') {
      throw new ApiError(409, 'Cannot activate an archived theme. Please duplicate or restore it first.');
    }

    const summary = await this.getMappingSummary(themeId);

    // Atomic update of storefront settings
    const previousActive = await WebsiteTheme.findOne({ status: 'active', 'meta.deletedAt': null });
    const prevId = previousActive ? previousActive._id : null;

    const updatedSettings = await WebsiteThemeSettings.findOneAndUpdate(
      { key: 'storefront' },
      {
        $set: {
          activeThemeId: theme._id,
          scheduledThemeId: null,
          previousThemeId: prevId,
        },
        $inc: { revision: 1 },
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Deactivate all previously active themes
    await WebsiteTheme.updateMany(
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

    return {
      message: `Theme "${theme.name}" activated successfully! Storefront is now using this theme.`,
      theme: {
        _id: theme._id,
        name: theme.name,
        code: theme.code,
        status: theme.status,
      },
      revision: updatedSettings.revision,
      summary: summary.summary,
    };
  }

  /**
   * 9. Storefront dynamic media resolver:
   * Merges active theme mappings onto module records seamlessly.
   */
  async resolveRecordsForStorefront(module, records, activeThemeId = null) {
    if (!records || (Array.isArray(records) && records.length === 0)) {
      return records;
    }

    const normModule = normalizeModule(module);

    let themeId = activeThemeId;
    if (!themeId) {
      const settings = await WebsiteThemeSettings.findOne({ key: 'storefront' }).lean();
      themeId = settings?.activeThemeId;
    }

    if (!themeId) {
      return records;
    }

    const isArray = Array.isArray(records);
    const recordList = isArray ? records : [records];
    const recordIds = recordList.map((r) => r._id).filter(Boolean);

    if (recordIds.length === 0) return records;

    const mappings = await ThemeMediaMapping.find({
      themeId,
      module: normModule,
      recordId: { $in: recordIds },
      status: 'active',
      'meta.deletedAt': null,
    })
      .populate('mediaId')
      .lean();

    if (mappings.length === 0) return records;

    // Group mappings by recordId
    const mapByRecord = new Map();
    mappings.forEach((m) => {
      const rId = String(m.recordId);
      if (!mapByRecord.has(rId)) mapByRecord.set(rId, []);
      mapByRecord.get(rId).push(m);
    });

    const resolved = recordList.map((item) => {
      const rId = String(item._id);
      const mList = mapByRecord.get(rId);
      if (!mList || mList.length === 0) return item;

      const clone = { ...item, isThemeMedia: true };

      if (normModule === 'category') {
        const iconMap = mList.find((m) => m.placement === 'icon');
        const bannerMap = mList.find((m) => m.placement === 'banner');
        if (iconMap?.mediaId?.image?.url) {
          clone.icon = {
            url: iconMap.mediaId.image.url,
            key: iconMap.mediaId.image.key || '',
          };
        }
        if (bannerMap?.mediaId?.image?.url) {
          clone.banner = {
            url: bannerMap.mediaId.image.url,
            key: bannerMap.mediaId.image.key || '',
          };
        }
      } else if (normModule === 'celebrate') {
        const primaryMap = mList.find((m) => m.placement === 'primary' || !m.placement);
        if (primaryMap?.mediaId?.image?.url) {
          clone.image = {
            url: primaryMap.mediaId.image.url,
            key: primaryMap.mediaId.image.key || '',
          };
        }
      } else {
        // Banner modules
        const desktopMap = mList.find(
          (m) => (m.device === 'desktop' || m.device === 'common') && m.placement === 'primary'
        );
        const mobileMap = mList.find(
          (m) => m.device === 'mobile' || m.placement === 'mobile'
        );

        if (desktopMap?.mediaId?.image?.url) {
          clone.image = {
            url: desktopMap.mediaId.image.url,
            key: desktopMap.mediaId.image.key || '',
          };
        }
        if (mobileMap?.mediaId?.image?.url) {
          clone.mobileImage = {
            url: mobileMap.mediaId.image.url,
            key: mobileMap.mediaId.image.key || '',
          };
        }

        // Collection banner tiles: tile:0, tile:1, etc.
        const tileMaps = mList.filter((m) => String(m.placement || '').startsWith('tile:'));
        if (tileMaps.length > 0 && Array.isArray(clone.collectionImages)) {
          clone.collectionImages = clone.collectionImages.map((tile, idx) => {
            const tileMap = tileMaps.find((tm) => tm.placement === `tile:${idx}`);
            if (tileMap?.mediaId?.image?.url) {
              return {
                ...tile,
                url: tileMap.mediaId.image.url,
                key: tileMap.mediaId.image.key || '',
              };
            }
            return tile;
          });
        }
      }

      return clone;
    });

    return isArray ? resolved : resolved[0];
  }
}

module.exports = new ThemeMediaMappingService();
