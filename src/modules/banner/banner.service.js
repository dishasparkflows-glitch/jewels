const Banner = require('./banner.model');
const Category = require('../category/category.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class BannerService {
  _formatBanner(banner) {
    if (!banner) return null;
    return banner.toObject ? banner.toObject() : banner;
  }

  // ------------------------------- create banner ----------------------------
  async create(data) {
    const created = await Banner.create(data);
    const populated = await Banner.findById(created._id).populate('display.categoryId', 'name slug');
    return this._formatBanner(populated);
  }

  // ------------------------------- get one banner ----------------------------
  async getOne(id) {
    const banner = await Banner.findOne({ _id: id }).populate('display.categoryId', 'name slug');
    if (!banner) {
      throw new ApiError(404, 'Banner not found');
    }
    return this._formatBanner(banner);
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
            endDate: { $ne: null, $lt: now },
          },
        ],
      });
    }

    // 2. Filter by banner type
    if (queryParams.type) {
      andConditions.push({ 'display.type': queryParams.type });

      if (queryParams.type === 'offerbanner' && queryParams.status === 'active') {
        andConditions.push({
          $or: [{ endDate: null }, { endDate: { $gte: now } }],
        });
        andConditions.push({
          $or: [{ startDate: null }, { startDate: { $lte: now } }],
        });
      }
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

    const [items, total] = await Promise.all([
      Banner.find(filter)
        .populate('display.categoryId', 'name slug')
        .sort({ 'display.order': 1, 'meta.createdAt': -1 })
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
    const now = new Date();
    const andConditions = [
      { status: 'active' },
      {
        $nor: [
          {
            'display.type': 'offerbanner',
            endDate: { $ne: null, $lt: now },
          },
        ],
      },
    ];

    if (queryParams.type) {
      andConditions.push({ 'display.type': queryParams.type });
    }

    if (queryParams.category) {
      andConditions.push({ 'display.categoryId': queryParams.category });
    }

    const filter = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];

    const items = await Banner.find(filter)
      .populate('display.categoryId', 'name slug')
      .sort({ 'display.order': 1, 'meta.createdAt': -1 })
      .lean();

    return items.map((item) => this._formatBanner(item));
  }

  // ----------------------- get category display banner -----------------------
  async getCategoryDisplayBanner(categoryId = null) {
    const now = new Date();

    const baseOfferConds = [
      { status: 'active' },
      { 'display.type': 'offerbanner' },
      { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
      { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
    ];

    if (categoryId) {
      const categorySpecificOffer = await Banner.findOne({
        $and: [
          ...baseOfferConds,
          { 'display.categoryId': categoryId },
        ],
      })
        .populate('display.categoryId', 'name slug')
        .sort({ 'display.order': 1, 'meta.createdAt': -1 })
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
      $and: baseOfferConds,
    })
      .populate('display.categoryId', 'name slug')
      .sort({ 'display.order': 1, 'meta.createdAt': -1 })
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
          { 'display.categoryId': categoryId },
        ],
      })
        .populate('display.categoryId', 'name slug')
        .sort({ 'display.order': 1, 'meta.createdAt': -1 })
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
    const banner = await Banner.findOneAndUpdate(
      { _id: id },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    ).populate('display.categoryId', 'name slug');

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
      endDate: { $ne: null, $lt: now },
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
