const mongoose = require('mongoose');
const Banner = require('./banner.model');
const Category = require('../category/category.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class BannerService {
  _formatBanner(banner) {
    if (!banner) return null;
    const doc = banner.toObject ? banner.toObject() : { ...banner };
    if (Array.isArray(doc.collectionImages) && doc.collectionImages.length > 0) {
      doc.collectionImages.sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
    }
    return doc;
  }

  // ------------------------------- create banner ----------------------------
  async create(data) {
    return await Banner.create(data);
  }

  // ------------------------------- get one banner ----------------------------
  async getOne(id) {
    const banner = await Banner.findOne({ _id: id })
      .populate('display.categoryId', 'name slug')
      .populate('collectionImages.categoryId', 'name slug')
      .populate('display.menuItemIds', 'title menuSectionId');

    if (!banner) {
      throw new ApiError(404, 'Banner not found');
    }
    return this._formatBanner(banner);
  }

  // ------------------------------- get banner counts by type ----------------------------
  async getCounts() {
    const filter = { 'meta.deletedAt': null };
    const counts = await Banner.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $toLower: { $ifNull: ['$display.type', 'websitebanner'] } },
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {
      herobanner: 0,
      collectionbanner: 0,
      categorybanner: 0,
      offerbanner: 0,
      mobileappbanner: 0,
      bookappointbanner: 0,
      customizebanner: 0,
      websitebanner: 0,
      total: 0,
    };

    let total = 0;
    counts.forEach((item) => {
      const type = item._id || 'websitebanner';
      if (result[type] !== undefined) {
        result[type] = item.count;
      } else {
        result.websitebanner = (result.websitebanner || 0) + item.count;
      }
      total += item.count;
    });
    result.total = total;

    return result;
  }

  // ------------------------------- get all banners ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const now = new Date();
    const andConditions = [{ 'meta.deletedAt': null }];

    if (queryParams.status) {
      andConditions.push({ status: queryParams.status });
    }

    // 1. Exclude expired offer banners unless explicitly included
    if (queryParams.includeExpired !== 'true' && queryParams.includeExpired !== true) {
      andConditions.push({
        $nor: [
          {
            'display.type': 'offerbanner',
            endDate: { $ne: null, $exists: true, $lt: now },
          },
        ],
      });
    }

    // 2. Filter by banner type
    if (queryParams.type) {
      andConditions.push({ 'display.type': queryParams.type });

      if (queryParams.type === 'offerbanner' && queryParams.status === 'active') {
        andConditions.push({
          $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gte: now } }],
        });
        andConditions.push({
          $or: [{ startDate: null }, { startDate: { $exists: false } }, { startDate: { $lte: now } }],
        });
      }
    }

    if (queryParams.platform) {
      andConditions.push({ 'display.platform': queryParams.platform });
    }

    // 3. Filter by category
    if (queryParams.category) {
      andConditions.push({ 'display.categoryId': queryParams.category });
    }

    // 4. Filter by bannerKey
    if (queryParams.bannerKey) {
      andConditions.push({ 'display.bannerKey': queryParams.bannerKey });
    }

    // 5. Search query
    if (queryParams.search) {
      const searchRegex = new RegExp(queryParams.search, 'i');
      andConditions.push({
        $or: [
          { 'content.title': searchRegex },
          { 'content.subtitle': searchRegex },
        ],
      });
    }

    const filter = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];

    let sort = { 'display.order': 1, 'meta.createdAt': -1 };
    if (queryParams.sortBy === 'order_asc') {
      sort = { 'display.order': 1, 'meta.createdAt': -1 };
    } else if (queryParams.sortBy === 'order_desc') {
      sort = { 'display.order': -1, 'meta.createdAt': -1 };
    } else if (queryParams.sortBy === 'oldest') {
      sort = { 'meta.createdAt': 1 };
    } else if (queryParams.sortBy === 'newest') {
      sort = { 'meta.createdAt': -1 };
    }

    const [items, total] = await Promise.all([
      Banner.find(filter)
        .populate('display.categoryId', 'name slug')
        .populate('collectionImages.categoryId', 'name slug')
        .populate('display.menuItemIds', 'title menuSectionId')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Banner.countDocuments(filter),
    ]);

    return {
      items: items.map((item) => this._formatBanner(item)),
      pagination: getPaginationMeta(total, page, limit),
    };
  }

  // ------------------------------- get banner lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = {
      'meta.deletedAt': null,
    };

    if (queryParams.status) {
      if (queryParams.status !== 'all') {
        filter.status = queryParams.status;
      }
    } else {
      filter.status = 'active';
    }

    const targetType = queryParams.type || queryParams.module;
    if (targetType && targetType !== 'all') {
      if (targetType === 'category' || targetType === 'categorybanner') {
        filter['display.type'] = { $in: ['category', 'categorybanner'] };
      } else {
        filter['display.type'] = targetType;
      }
    }

    if (queryParams.category) {
      filter['display.categoryId'] = queryParams.category;
    }

    if (queryParams.platform) {
      filter.$or = [
        { 'display.platform': queryParams.platform },
        { 'display.type': 'mobileappbanner' },
      ];
    }

    const items = await Banner.find(filter)
      .select(
        '_id content.title content.subtitle display.type display.platform display.order display.collectionGroup display.categoryId image mobileImage collectionImages status'
      )
      .populate('display.categoryId', 'name slug')
      .populate('collectionImages.categoryId', 'name slug')
      .sort({ 'display.order': 1, _id: -1 })
      .lean();

    items.forEach((item) => {
      if (Array.isArray(item.collectionImages) && item.collectionImages.length > 0) {
        item.collectionImages.sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
      }
    });

    return items;
  }

  // ----------------------- get category display banner -----------------------
  async getCategoryDisplayBanner(categoryId = null, platform = 'web') {
    const now = new Date();
    let resolvedCatId = categoryId;
    let categoryDoc = null;
    if (categoryId) {
      if (mongoose.isValidObjectId(categoryId)) {
        categoryDoc = await Category.findOne({ _id: categoryId }).lean();
        if (categoryDoc) {
          resolvedCatId = categoryDoc._id;
        }
      } else {
        categoryDoc = await Category.findOne({
          $or: [
            { slug: String(categoryId).trim().toLowerCase() },
            { name: new RegExp('^' + categoryId + '$', 'i') },
          ],
          'meta.deletedAt': null,
        }).lean();
        if (categoryDoc) {
          resolvedCatId = categoryDoc._id;
        }
      }
    }
    const selectedPlatform = ['web', 'mobile'].includes(platform) ? platform : 'web';
    const platformCondition = selectedPlatform === 'web'
      ? { $or: [{ 'display.platform': 'web' }, { 'display.platform': 'common' }, { 'display.platform': 'all' }, { 'display.platform': { $exists: false } }, { 'display.platform': null }] }
      : { $or: [{ 'display.platform': selectedPlatform }, { 'display.platform': 'common' }, { 'display.platform': 'all' }, { 'display.platform': { $exists: false } }, { 'display.platform': null }] };

    const baseOfferConds = [
      { status: 'active' },
      { 'display.type': 'offerbanner' },
      platformCondition,
      { $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gte: now } }] },
      { $or: [{ startDate: null }, { startDate: { $exists: false } }, { startDate: { $lte: now } }] },
    ];

    // 1. Check for category-specific offer banner
    if (resolvedCatId) {
      const categorySpecificOffer = await Banner.findOne({
        $and: [
          ...baseOfferConds,
          { 'display.categoryId': resolvedCatId },
        ],
      })
        .select('-meta')
        .populate('display.categoryId', 'name slug')
        .populate('collectionImages.categoryId', 'name slug')
        .sort({ 'display.order': 1, _id: -1 })
        .lean();

      if (categorySpecificOffer) {
        return {
          banner: this._formatBanner(categorySpecificOffer),
          source: 'offerbanner',
          isOffer: true,
          type: 'offerbanner',
        };
      }
    }

    // 2. Check for category-specific categorybanner in Banner collection
    if (resolvedCatId) {
      const categoryBanner = await Banner.findOne({
        $and: [
          { status: 'active' },
          { 'display.type': 'categorybanner' },
          platformCondition,
          { 'display.categoryId': resolvedCatId },
        ],
      })
        .select('-meta')
        .populate('display.categoryId', 'name slug')
        .populate('collectionImages.categoryId', 'name slug')
        .sort({ 'display.order': 1, _id: -1 })
        .lean();

      if (categoryBanner) {
        return {
          banner: this._formatBanner(categoryBanner),
          source: 'categorybanner',
          isOffer: false,
          type: 'categorybanner',
        };
      }
    }

    // 3. Fallback to category model's own banner image (if configured)
    try {
      if (!categoryDoc && resolvedCatId && mongoose.isValidObjectId(resolvedCatId)) {
        categoryDoc = await Category.findOne({ _id: resolvedCatId }).lean();
      }

      if (categoryDoc) {
        const bannerUrl =
          categoryDoc.banner?.url ||
          (typeof categoryDoc.banner === 'string' ? categoryDoc.banner : null) ||
          (Array.isArray(categoryDoc.images) && categoryDoc.images[0]?.url);

        if (bannerUrl) {
          return {
            banner: {
              _id: `category-banner-${categoryDoc._id}`,
              content: {
                title: categoryDoc.name || 'Category Banner',
                subtitle: '',
                description: '',
              },
              image: {
                url: bannerUrl,
                key: categoryDoc.banner?.key || '',
                mediaType: 'image',
              },
              display: {
                type: 'categorybanner',
                platform: selectedPlatform,
                categoryId: {
                  _id: categoryDoc._id,
                  name: categoryDoc.name,
                  slug: categoryDoc.slug,
                },
                order: 0,
              },
            },
            source: 'category_model',
            isOffer: false,
            type: 'categorybanner',
          };
        }
      }
    } catch (catErr) {
      console.warn('Failed to fetch category model banner fallback:', catErr.message);
    }

    // 4. Fallback to active theme or default category banner
    try {
      const { Theme } = require('../theme/theme.model');
      const activeTheme = await Theme.findOne({ status: 'active', 'meta.deletedAt': null }).select('_id name').lean();

      const themeBanner = await Banner.findOne({
        $and: [
          { status: 'active' },
          { 'display.type': 'categorybanner' },
          platformCondition,
        ],
      })
        .select('-meta')
        .populate('display.categoryId', 'name slug')
        .sort({ 'display.order': 1, _id: -1 })
        .lean();

      if (themeBanner) {
        return {
          banner: this._formatBanner(themeBanner),
          source: 'theme_categorybanner',
          isOffer: false,
          type: 'categorybanner',
        };
      }

      if (activeTheme) {
        const Gallery = require('../gallery/gallery.model');
        const galleryItem = await Gallery.findOne({
          placement: 'categorybanner',
          themeId: activeTheme._id,
          status: { $ne: 'inactive' },
        }).lean();

        if (galleryItem && galleryItem.image?.url) {
          return {
            banner: {
              _id: `gallery-category-${galleryItem._id}`,
              content: {
                title: categoryDoc?.name || activeTheme.name || 'Category Banner',
                subtitle: '',
                description: '',
              },
              image: galleryItem.image,
              display: {
                type: 'categorybanner',
                platform: selectedPlatform,
                categoryId: categoryDoc ? {
                  _id: categoryDoc._id,
                  name: categoryDoc.name,
                  slug: categoryDoc.slug,
                } : null,
                order: 0,
              },
            },
            source: 'gallery_categorybanner',
            isOffer: false,
            type: 'categorybanner',
          };
        }
      }
    } catch (themeErr) {
      console.warn('Failed to fetch theme category banner fallback:', themeErr.message);
    }

    // 5. Fallback to general offer banner (if any active offer banner exists without specific category)
    const generalOffer = await Banner.findOne({
      $and: [
        ...baseOfferConds,
        platformCondition,
        { $or: [{ 'display.categoryId': null }, { 'display.categoryId': { $exists: false } }] },
      ],
    })
      .select('-meta')
      .populate('display.categoryId', 'name slug')
      .populate('collectionImages.categoryId', 'name slug')
      .sort({ 'display.order': 1, _id: -1 })
      .lean();

    if (generalOffer) {
      return {
        banner: this._formatBanner(generalOffer),
        source: 'offerbanner',
        isOffer: true,
        type: 'offerbanner',
      };
    }

    return {
      banner: null,
      source: 'none',
      isOffer: false,
      type: null,
    };
  }

  // ------------------------------- update banner ----------------------------
  async update(id, data) {
    const banner = await Banner.findOneAndUpdate(
      { _id: id },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    );

    if (!banner) {
      throw new ApiError(404, 'Banner not found');
    }

    return banner;
  }

  // ------------------------------- delete banner ----------------------------
  async delete(id) {
    const banner = await Banner.findOneAndUpdate(
      { _id: id },
      { $set: { status: 'inactive', 'meta.deletedAt': new Date() } },
      { returnDocument: 'after' }
    );

    if (!banner) {
      throw new ApiError(404, 'Banner not found');
    }

    return { message: 'Banner deleted successfully', id };
  }

  // ------------------------------- bulk delete banners ----------------------------
  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, 'Please provide an array of banner IDs to delete');
    }

    const result = await Banner.updateMany(
      { _id: { $in: ids } },
      { $set: { status: 'inactive', 'meta.deletedAt': new Date() } }
    );

    return {
      message: `${result.modifiedCount} banner(s) deleted successfully`,
      deletedCount: result.modifiedCount,
      ids,
    };
  }

  // ----------------------- auto delete expired offers (cron) -----------------
  async autoDeleteExpiredOffers() {
    const now = new Date();
    const filter = {
      'display.type': 'offerbanner',
      endDate: { $ne: null, $exists: true, $lt: now },
    };

    const expiredOffers = await Banner.find(filter)
      .select('_id content.title display.type endDate')
      .lean();

    if (!expiredOffers || expiredOffers.length === 0) {
      return { deletedCount: 0, expiredIds: [] };
    }

    const expiredIds = expiredOffers.map((b) => b._id);
    const result = await Banner.updateMany(
      { _id: { $in: expiredIds } },
      { $set: { status: 'inactive', 'meta.deletedAt': now } }
    );

    console.log(
      `[Banner Cron] 🕒 Auto-deleted ${result.modifiedCount} expired offer banner(s):`,
      expiredOffers.map((o) => `[ID: ${o._id}, Title: "${o.content?.title || 'Offer'}", EndDate: ${o.endDate}]`).join(', ')
    );

    return {
      deletedCount: result.modifiedCount,
      expiredIds,
    };
  }
}

module.exports = new BannerService();
