const Banner = require('./banner.model');
const Category = require('../category/category.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

function sanitizeStr(s) {
  return typeof s === 'string' ? s.trim() : s;
}

function isEmptyStr(s) {
  return typeof s === 'string' && s.trim() === '';
}

function isNullOrEmpty(v) {
  return v === null || v === undefined || isEmptyStr(v);
}

function sanitizeBannerPayload(data) {
  if (!data || typeof data !== 'object') return data;

  const clean = {};

  // Content
  if (data.content && typeof data.content === 'object') {
    const cleanContent = {};
    for (const field of ['title', 'subtitle', 'description']) {
      if (!isNullOrEmpty(data.content[field])) {
        cleanContent[field] = sanitizeStr(data.content[field]);
      }
    }
    if (Object.keys(cleanContent).length > 0) {
      clean.content = cleanContent;
    }
  }

  // Display
  if (data.display && typeof data.display === 'object') {
    const cleanDisplay = {};
    for (const field of ['categoryId', 'collectionGroup', 'type', 'platform', 'position', 'order']) {
      if (!isNullOrEmpty(data.display[field])) {
        cleanDisplay[field] = sanitizeStr(data.display[field]);
      }
    }
    if (Array.isArray(data.display.menuItemIds) && data.display.menuItemIds.length > 0) {
      const cleanMenuIds = data.display.menuItemIds.filter((id) => !isNullOrEmpty(id));
      if (cleanMenuIds.length > 0) cleanDisplay.menuItemIds = cleanMenuIds;
    }
    if (Object.keys(cleanDisplay).length > 0) {
      clean.display = cleanDisplay;
    }
  }

  // Root fields
  for (const field of ['themeId', 'link', 'appStoreUrl', 'googlePlayUrl', 'mediaType', 'startDate', 'endDate', 'status']) {
    if (!isNullOrEmpty(data[field])) {
      clean[field] = sanitizeStr(data[field]);
    }
  }

  // Image
  if (data.image && typeof data.image === 'object' && !isNullOrEmpty(data.image.url)) {
    const cleanImg = { url: sanitizeStr(data.image.url) };
    if (!isNullOrEmpty(data.image.key)) {
      cleanImg.key = sanitizeStr(data.image.key);
    }
    clean.image = cleanImg;
  }

  // Mobile Image
  if (data.mobileImage && typeof data.mobileImage === 'object' && !isNullOrEmpty(data.mobileImage.url)) {
    const cleanMobileImg = { url: sanitizeStr(data.mobileImage.url) };
    if (!isNullOrEmpty(data.mobileImage.key)) {
      cleanMobileImg.key = sanitizeStr(data.mobileImage.key);
    }
    clean.mobileImage = cleanMobileImg;
  }

  // Video
  if (data.video && typeof data.video === 'object' && !isNullOrEmpty(data.video.url)) {
    const cleanVid = { url: sanitizeStr(data.video.url) };
    if (!isNullOrEmpty(data.video.key)) {
      cleanVid.key = sanitizeStr(data.video.key);
    }
    clean.video = cleanVid;
  }

  // CollectionImages
  if (Array.isArray(data.collectionImages) && data.collectionImages.length > 0) {
    const cleanImgs = data.collectionImages
      .map((img) => {
        if (!img || isNullOrEmpty(img.url)) return null;
        const item = { url: sanitizeStr(img.url) };
        if (!isNullOrEmpty(img.categoryId)) item.categoryId = img.categoryId;
        if (!isNullOrEmpty(img.key)) item.key = sanitizeStr(img.key);
        return item;
      })
      .filter(Boolean);
    if (cleanImgs.length > 0) {
      clean.collectionImages = cleanImgs;
    }
  }

  return clean;
}

function buildBannerUpdateOps(data) {
  if (!data || typeof data !== 'object') return { $set: data || {} };

  const $set = {};
  const $unset = {};

  // Content
  if (data.content !== undefined) {
    if (isNullOrEmpty(data.content)) {
      $unset['content'] = 1;
    } else if (typeof data.content === 'object') {
      for (const field of ['title', 'subtitle', 'description']) {
        if (data.content[field] !== undefined) {
          if (isNullOrEmpty(data.content[field])) {
            $unset[`content.${field}`] = 1;
          } else {
            $set[`content.${field}`] = sanitizeStr(data.content[field]);
          }
        }
      }
    }
  }

  // Display
  if (data.display !== undefined) {
    if (isNullOrEmpty(data.display)) {
      $unset['display'] = 1;
    } else if (typeof data.display === 'object') {
      const displayFields = ['categoryId', 'collectionGroup', 'type', 'platform', 'position', 'order'];
      for (const field of displayFields) {
        if (data.display[field] !== undefined) {
          if (isNullOrEmpty(data.display[field])) {
            $unset[`display.${field}`] = 1;
          } else {
            $set[`display.${field}`] = sanitizeStr(data.display[field]);
          }
        }
      }
      if (data.display.menuItemIds !== undefined) {
        if (!Array.isArray(data.display.menuItemIds) || data.display.menuItemIds.length === 0) {
          $unset['display.menuItemIds'] = 1;
        } else {
          $set['display.menuItemIds'] = data.display.menuItemIds.filter((id) => !isNullOrEmpty(id));
        }
      }
    }
  }

  // Root fields
  const simpleFields = ['themeId', 'link', 'appStoreUrl', 'googlePlayUrl', 'mediaType', 'startDate', 'endDate', 'status'];
  for (const field of simpleFields) {
    if (data[field] !== undefined) {
      if (isNullOrEmpty(data[field])) {
        $unset[field] = 1;
      } else {
        $set[field] = sanitizeStr(data[field]);
      }
    }
  }

  // Image
  if (data.image !== undefined) {
    if (isNullOrEmpty(data.image) || isNullOrEmpty(data.image.url)) {
      $unset['image'] = 1;
    } else {
      const cleanImg = { url: sanitizeStr(data.image.url) };
      if (!isNullOrEmpty(data.image.key)) {
        cleanImg.key = sanitizeStr(data.image.key);
      }
      $set['image'] = cleanImg;
    }
  }

  // Mobile Image
  if (data.mobileImage !== undefined) {
    if (isNullOrEmpty(data.mobileImage) || isNullOrEmpty(data.mobileImage.url)) {
      $unset['mobileImage'] = 1;
    } else {
      const cleanMobileImg = { url: sanitizeStr(data.mobileImage.url) };
      if (!isNullOrEmpty(data.mobileImage.key)) {
        cleanMobileImg.key = sanitizeStr(data.mobileImage.key);
      }
      $set['mobileImage'] = cleanMobileImg;
    }
  }

  // Video
  if (data.video !== undefined) {
    if (isNullOrEmpty(data.video) || isNullOrEmpty(data.video.url)) {
      $unset['video'] = 1;
    } else {
      const cleanVid = { url: sanitizeStr(data.video.url) };
      if (!isNullOrEmpty(data.video.key)) {
        cleanVid.key = sanitizeStr(data.video.key);
      }
      $set['video'] = cleanVid;
    }
  }

  // If mediaType is explicitly set, unset the opposite media
  if (data.mediaType === 'image') {
    $unset['video'] = 1;
  } else if (data.mediaType === 'video') {
    $unset['image'] = 1;
    $unset['collectionImages'] = 1;
  }

  // If display.type is explicitly set and not collectionbanner, unset collectionImages
  if (data.display?.type && data.display.type !== 'collectionbanner') {
    $unset['collectionImages'] = 1;
  }

  // CollectionImages
  if (data.collectionImages !== undefined) {
    if (!Array.isArray(data.collectionImages) || data.collectionImages.length === 0) {
      $unset['collectionImages'] = 1;
    } else {
      const cleanImages = data.collectionImages
        .map((img) => {
          if (!img || isNullOrEmpty(img.url)) return null;
          const item = { url: sanitizeStr(img.url) };
          if (!isNullOrEmpty(img.categoryId)) item.categoryId = img.categoryId;
          if (!isNullOrEmpty(img.key)) item.key = sanitizeStr(img.key);
          return item;
        })
        .filter(Boolean);
      if (cleanImages.length > 0) {
        $set['collectionImages'] = cleanImages;
      } else {
        $unset['collectionImages'] = 1;
      }
    }
  }

  const updateQuery = {};
  if (Object.keys($set).length > 0) updateQuery.$set = $set;
  if (Object.keys($unset).length > 0) updateQuery.$unset = $unset;

  return updateQuery;
}

class BannerService {
  _formatBanner(banner) {
    if (!banner) return null;
    return banner.toObject ? banner.toObject() : banner;
  }

  // ------------------------------- create banner ----------------------------
  async create(data) {
    if (data.display?.type === 'collectionbanner' && Array.isArray(data.collectionImages) && data.collectionImages.length > 0 && data.collectionImages.length !== 4) {
      throw new ApiError(400, 'Collection banners must contain exactly four images if images are provided');
    }
    const cleanData = sanitizeBannerPayload(data);
    const created = await Banner.create(cleanData);
    const populated = await Banner.findById(created._id)
      .populate('display.categoryId', 'name slug')
      .populate('collectionImages.categoryId', 'name slug')
      .populate('display.menuItemIds', 'title menuSectionId');
    return this._formatBanner(populated);
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

    // 5. Filter by position
    if (queryParams.position && queryParams.position !== 'all') {
      andConditions.push({ 'display.position': queryParams.position });
    }

    // 6. Search query
    if (queryParams.search) {
      const searchRegex = new RegExp(queryParams.search, 'i');
      andConditions.push({
        $or: [
          { 'content.title': searchRegex },
          { 'content.subtitle': searchRegex },
          { 'display.position': searchRegex },
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
      status: 'active',
      'meta.deletedAt': null,
    };

    if (queryParams.type) {
      filter['display.type'] = queryParams.type;
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
      .select('-meta')
      .populate('display.categoryId', 'name slug')
      .populate('collectionImages.categoryId', 'name slug')
      .populate('display.menuItemIds', 'title menuSectionId')
      .sort({ 'display.order': 1, _id: -1 })
      .lean();

    return items;
  }

  // ----------------------- get category display banner -----------------------
  async getCategoryDisplayBanner(categoryId = null, platform = 'web') {
    const now = new Date();
    const selectedPlatform = ['web', 'mobile'].includes(platform) ? platform : 'web';
    const platformCondition = selectedPlatform === 'web'
      ? { $or: [{ 'display.platform': 'web' }, { 'display.platform': { $exists: false } }] }
      : { 'display.platform': selectedPlatform };

    const baseOfferConds = [
      { status: 'active' },
      { 'display.type': 'offerbanner' },
      platformCondition,
      { $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gte: now } }] },
      { $or: [{ startDate: null }, { startDate: { $exists: false } }, { startDate: { $lte: now } }] },
    ];

    if (categoryId) {
      const categorySpecificOffer = await Banner.findOne({
        $and: [
          ...baseOfferConds,
          { 'display.categoryId': categoryId },
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

    const generalOffer = await Banner.findOne({
      $and: [...baseOfferConds, platformCondition],
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

    if (categoryId) {
      const categoryBanner = await Banner.findOne({
        $and: [
          { status: 'active' },
          { 'display.type': 'categorybanner' },
          platformCondition,
          { 'display.categoryId': categoryId },
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

      try {
        const categoryDoc = await Category.findOne({
          _id: categoryId,
        }).lean();

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
                },
                mediaType: 'image',
                display: {
                  type: 'categorybanner',
                  platform: selectedPlatform,
                  categoryId: {
                    _id: categoryDoc._id,
                    name: categoryDoc.name,
                    slug: categoryDoc.slug,
                  },
                  order: 0,
                  position: 'none',
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
    if (data.display?.type === 'collectionbanner' || data.collectionImages !== undefined) {
      const existing = await Banner.findById(id).select('display.type collectionImages').lean();
      if (!existing) throw new ApiError(404, 'Banner not found');
      const nextType = data.display?.type || existing.display?.type;
      const nextImages = data.collectionImages !== undefined ? data.collectionImages : existing.collectionImages;
      if (nextType === 'collectionbanner' && Array.isArray(nextImages) && nextImages.length > 0 && nextImages.length !== 4) {
        throw new ApiError(400, 'Collection banners must contain exactly four images if images are provided');
      }
    }
    const updateOps = buildBannerUpdateOps(data);
    if (!updateOps.$set && !updateOps.$unset) {
      return this.getOne(id);
    }
    const banner = await Banner.findOneAndUpdate(
      { _id: id },
      updateOps,
      { returnDocument: 'after', runValidators: true }
    )
      .populate('display.categoryId', 'name slug')
      .populate('collectionImages.categoryId', 'name slug')
      .populate('display.menuItemIds', 'title menuSectionId');

    if (!banner) {
      throw new ApiError(404, 'Banner not found');
    }

    return this._formatBanner(banner);
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
