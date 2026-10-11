const HomeSection = require('./homeSection.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class HomeSectionService {
  /**
   * Helper to slugify string into a valid sectionKey
   */
  slugify(text) {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[\s\W-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // ------------------------------- Create Home Section ----------------------------
  async create(data) {
    if (!data.title || !data.title.trim()) {
      throw new ApiError(400, 'Section title is required');
    }
    data.title = data.title.trim();

    if (!data.sectionKey || !data.sectionKey.trim()) {
      data.sectionKey = this.slugify(data.title);
    } else {
      data.sectionKey = this.slugify(data.sectionKey);
    }

    // Check for duplicate active key
    const existing = await HomeSection.findOne({
      sectionKey: data.sectionKey,
      isDeleted: false,
    });
    if (existing) {
      data.sectionKey = `${data.sectionKey}-${Date.now().toString().slice(-4)}`;
    }

    // Auto calculate order if not specified
    if (data.order === undefined || data.order === null || isNaN(data.order)) {
      const highest = await HomeSection.findOne({ isDeleted: false })
        .sort({ order: -1 })
        .select('order')
        .lean();
      data.order = highest && highest.order !== undefined ? highest.order + 1 : 1;
    }

    return await HomeSection.create(data);
  }

  // ------------------------------- Get All (Admin with Pagination) ----------------------------
  async getAll(queryParams = {}) {
    // If database has 0 sections, optionally seed defaults
    const totalCount = await HomeSection.countDocuments({ isDeleted: false });
    if (totalCount === 0) {
      await this.seedDefaults();
    }

    const { page, limit, skip } = getPagination(queryParams);
    const filter = { isDeleted: false };

    if (queryParams.status && queryParams.status !== 'all') {
      filter.status = queryParams.status;
    }

    if (queryParams.sectionType && queryParams.sectionType !== 'all') {
      filter.sectionType = queryParams.sectionType;
    }

    if (queryParams.placement && queryParams.placement !== 'all') {
      filter.placement = queryParams.placement;
    }

    if (queryParams.search) {
      const searchRegex = new RegExp(queryParams.search.trim(), 'i');
      filter.$or = [
        { title: searchRegex },
        { subtitle: searchRegex },
        { sectionKey: searchRegex },
        { description: searchRegex },
      ];
    }

    const [items, total] = await Promise.all([
      HomeSection.find(filter)
        .populate('items.productId', 'title sku price images')
        .populate('items.categoryId', 'name slug')
        .sort({ order: 1, 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      HomeSection.countDocuments(filter),
    ]);

    return {
      items,
      pagination: getPaginationMeta(total, page, limit),
    };
  }

  // ------------------------------- Get Public (Storefront API) ----------------------------
  async getPublic(queryParams = {}) {
    const filter = { isDeleted: false, status: 'active' };

    if (queryParams.placement && queryParams.placement !== 'all') {
      filter.placement = { $in: [queryParams.placement, 'all'] };
    }

    if (queryParams.sectionType) {
      filter.sectionType = queryParams.sectionType;
    }

    // Auto-seed if completely empty
    const count = await HomeSection.countDocuments({ isDeleted: false });
    if (count === 0) {
      await this.seedDefaults();
    }

    const sections = await HomeSection.find(filter)
      .populate('items.productId', 'title sku price images slug discountPrice')
      .populate('items.categoryId', 'name slug image')
      .sort({ order: 1 })
      .lean();

    return sections;
  }

  // ------------------------------- Get By Identifier Key ----------------------------
  async getByKey(key) {
    const section = await HomeSection.findOne({
      sectionKey: key.toLowerCase().trim(),
      isDeleted: false,
    })
      .populate('items.productId', 'title sku price images slug')
      .populate('items.categoryId', 'name slug')
      .lean();

    if (!section) {
      throw new ApiError(404, `Section with key "${key}" not found`);
    }
    return section;
  }

  // ------------------------------- Get One By ID ----------------------------
  async getOne(id) {
    const section = await HomeSection.findOne({ _id: id, isDeleted: false })
      .populate('items.productId', 'title sku price images')
      .populate('items.categoryId', 'name slug')
      .lean();

    if (!section) {
      throw new ApiError(404, 'Home section not found');
    }
    return section;
  }

  // ------------------------------- Update ----------------------------
  async update(id, data) {
    const section = await HomeSection.findOne({ _id: id, isDeleted: false });
    if (!section) {
      throw new ApiError(404, 'Home section not found');
    }

    if (data.title) {
      data.title = data.title.trim();
    }

    if (data.sectionKey) {
      data.sectionKey = this.slugify(data.sectionKey);
      const duplicate = await HomeSection.findOne({
        _id: { $ne: id },
        sectionKey: data.sectionKey,
        isDeleted: false,
      });
      if (duplicate) {
        throw new ApiError(409, `Section key "${data.sectionKey}" is already used by another section`);
      }
    }

    Object.assign(section, data);
    await section.save();
    return section;
  }

  // ------------------------------- Toggle Status ----------------------------
  async toggleStatus(id) {
    const section = await HomeSection.findOne({ _id: id, isDeleted: false });
    if (!section) {
      throw new ApiError(404, 'Home section not found');
    }

    section.status = section.status === 'active' ? 'inactive' : 'active';
    await section.save();
    return section;
  }

  // ------------------------------- Reorder Items ----------------------------
  async reorder(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new ApiError(400, 'Items array is required for reordering');
    }

    const bulkOps = items.map((item, index) => ({
      updateOne: {
        filter: { _id: item.id || item._id },
        update: { $set: { order: item.order !== undefined ? item.order : index + 1 } },
      },
    }));

    await HomeSection.bulkWrite(bulkOps);
    return { success: true, count: items.length };
  }

  // ------------------------------- Delete (Soft Delete) ----------------------------
  async delete(id) {
    const section = await HomeSection.findOne({ _id: id, isDeleted: false });
    if (!section) {
      throw new ApiError(404, 'Home section not found');
    }

    section.isDeleted = true;
    if (section.meta) {
      section.meta.deletedAt = new Date();
    }
    await section.save();
    return { id, message: 'Home section deleted successfully' };
  }

  // ------------------------------- Bulk Delete ----------------------------
  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, 'Array of IDs is required for bulk delete');
    }

    await HomeSection.updateMany(
      { _id: { $in: ids } },
      { $set: { isDeleted: true, 'meta.deletedAt': new Date() } }
    );

    return { success: true, count: ids.length };
  }

  // ------------------------------- Seed Defaults ----------------------------
  async seedDefaults() {
    const defaultSections = [
      {
        title: 'Hero Luxury Carousel',
        subtitle: 'Forever You',
        description: 'Grace in every curve. Sparkle in every detail. A necklace that speaks the language of elegance and the promise of forever.',
        sectionKey: 'hero-slider',
        sectionType: 'hero_slider',
        placement: 'home_top',
        order: 1,
        status: 'active',
        badgeText: 'NEW COLLECTION 2026',
        buttonText: 'Explore Collection',
        buttonLink: '/shop?category=pendant',
        image: { url: '/banners/hero_timeless.jpg' },
        items: [
          {
            title: 'TIMELESS BEAUTY, Forever You',
            subtitle: 'Curated Haute Joaillerie',
            description: 'Handcrafted with unyielding commitment to brilliant cut diamond excellence.',
            imageUrl: '/banners/hero_timeless.jpg',
            linkUrl: '/shop?category=pendant',
            buttonText: 'Shop Pendants',
            order: 1,
          },
          {
            title: 'THE ESSENCE OF BRILLIANCE',
            subtitle: 'Certified Lab-Grown Diamonds',
            description: 'Ethical luxury that shines with peerless fire and clarity.',
            imageUrl: '/promos/essence_necklace.jpg',
            linkUrl: '/shop?category=rings',
            buttonText: 'Discover Rings',
            order: 2,
          },
        ],
      },
      {
        title: 'Trust & Heritage Assurance',
        subtitle: 'Our Uncompromising Standards',
        sectionKey: 'trust-badges',
        sectionType: 'trust_badges',
        placement: 'home_top',
        order: 2,
        status: 'active',
        items: [
          {
            title: 'Ethically Sourced Diamonds',
            subtitle: '100% Conflict-free & Certified',
            badge: 'IGI & SGL Certified',
            order: 1,
          },
          {
            title: 'Complimentary Insured Delivery',
            subtitle: 'Discreet and secure door delivery',
            badge: 'Pan-India Insured',
            order: 2,
          },
          {
            title: 'Lifetime Exchange & Buyback',
            subtitle: 'Full transparency on all gold & jewels',
            badge: 'Guaranteed Valuation',
            order: 3,
          },
          {
            title: 'Bespoke Concierge Design',
            subtitle: 'Direct 1-on-1 artisan consultation',
            badge: 'Master Jeweler',
            order: 4,
          },
        ],
      },
      {
        title: 'Curated Categories & Gifts',
        subtitle: 'Celebrate Every Milestone',
        description: 'Discover jewelry designed to capture the magic of life’s unforgettable moments.',
        sectionKey: 'curated-collections',
        sectionType: 'category_grid',
        placement: 'home_middle',
        order: 3,
        status: 'active',
        buttonText: 'View All Categories',
        buttonLink: '/catalog',
        items: [
          {
            title: 'Necklace & Pendants',
            subtitle: 'Graceful statements',
            imageUrl: '/featured/necklace.jpg',
            linkUrl: '/shop?category=pendant',
            order: 1,
          },
          {
            title: 'Bangles & Bracelets',
            subtitle: 'Wristwear perfection',
            imageUrl: '/featured/bangles.jpg',
            linkUrl: '/shop?category=bangles-bracelets',
            order: 2,
          },
          {
            title: 'Earrings & Drops',
            subtitle: 'Subtle radiance',
            imageUrl: '/featured/earring.jpg',
            linkUrl: '/shop?category=earrings',
            order: 3,
          },
          {
            title: 'Solitaire Rings',
            subtitle: 'Icons of devotion',
            imageUrl: '/featured/ring.jpg',
            linkUrl: '/shop?category=rings',
            order: 4,
          },
        ],
      },
      {
        title: 'The Essence Collection',
        subtitle: 'Modern Luxury Redefined',
        sectionKey: 'essence-showcase',
        sectionType: 'banner_grid',
        placement: 'home_middle',
        order: 4,
        status: 'active',
        items: [
          {
            title: 'The Essence Collection',
            subtitle: 'Every facet reflects timeless perfection',
            imageUrl: '/promos/essence_necklace.jpg',
            linkUrl: '/shop?category=pendant',
            order: 1,
          },
          {
            title: 'A bracelet made distinctly yours',
            subtitle: 'Personalized charm & bezel settings',
            imageUrl: '/promos/bracelet_stone.jpg',
            linkUrl: '/shop?category=bangles-bracelets',
            order: 2,
          },
          {
            title: 'Made to Shine. Made to Last.',
            subtitle: 'Discover timeless diamond rings crafted with elegance',
            imageUrl: '/featured/ring.jpg',
            linkUrl: '/shop?category=rings',
            order: 3,
          },
          {
            title: 'Beauty With Intention',
            subtitle: 'Every facet is chosen to express something extraordinary',
            imageUrl: '/banners/hero_timeless.jpg',
            linkUrl: '/shop?category=earrings',
            order: 4,
          },
        ],
      },
      {
        title: 'Trending Solitaires & Most Loved',
        subtitle: 'Our Signature Creations',
        description: 'Selected for their outstanding design, brilliance, and coveted popularity.',
        sectionKey: 'most-loved',
        sectionType: 'product_carousel',
        placement: 'home_middle',
        order: 5,
        status: 'active',
        buttonText: 'View All Trending',
        buttonLink: '/shop?sort=popular',
        items: [
          {
            title: 'Round Diamond Engagement Ring',
            subtitle: 'Diamond Accent Band in 18k Rose Gold',
            imageUrl: '/featured/ring.jpg',
            linkUrl: '/shop?category=rings',
            badge: 'BESTSELLER',
            order: 1,
          },
          {
            title: 'Solitaire Pendant with Pavé Bail',
            subtitle: '1.50 Ct Brilliant Round Solitaire',
            imageUrl: '/featured/necklace.jpg',
            linkUrl: '/shop?category=pendant',
            badge: 'NEW',
            order: 2,
          },
          {
            title: 'Tennis Bracelet in White Gold',
            subtitle: 'Full Eternity Round Brilliant',
            imageUrl: '/featured/bangles.jpg',
            linkUrl: '/shop?category=bangles-bracelets',
            badge: 'SIGNATURE',
            order: 3,
          },
        ],
      },
      {
        title: 'Crafted For Your Story',
        subtitle: 'Bespoke & Custom Jewelry Studio',
        description: 'From dream sketches to certified 3D renders, our master jewelers bring your vision to life.',
        sectionKey: 'bespoke-spotlight',
        sectionType: 'promo_banner',
        placement: 'home_bottom',
        order: 6,
        status: 'active',
        badgeText: 'CUSTOM ATELIER',
        buttonText: 'Book a Consultation',
        buttonLink: '/appointments',
        image: { url: '/promos/essence_necklace.jpg' },
      },
      {
        title: 'Stories of Brilliance',
        subtitle: 'What Our Clients Say',
        description: 'Real words from customers who found their forever piece with Neirah Jewels.',
        sectionKey: 'client-reviews',
        sectionType: 'testimonials',
        placement: 'home_bottom',
        order: 7,
        status: 'active',
        items: [
          {
            title: 'Exceptional Craftsmanship',
            description: 'The solitaire ring surpassed all expectations. The fire and clarity in the diamond are breathtaking.',
            authorName: 'Aarav & Priya Sharma',
            authorLocation: 'Mumbai, India',
            rating: 5,
            order: 1,
          },
          {
            title: 'Seamless Custom Experience',
            description: 'Designing our anniversary band with the team was so intuitive. Certified diamonds and lifetime trust.',
            authorName: 'Rohan Mehra',
            authorLocation: 'New Delhi, India',
            rating: 5,
            order: 2,
          },
        ],
      },
    ];

    try {
      await HomeSection.insertMany(defaultSections);
    } catch (e) {
      console.warn('Seed default home sections skipped or already present:', e.message);
    }
  }
}

module.exports = new HomeSectionService();
