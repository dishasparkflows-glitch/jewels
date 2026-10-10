const NavigationMenu = require('./navigationMenu.model');
const ApiError = require('../../utils/ApiError');
const Category = require('../category/category.model');

class NavigationMenuService {
  // Auto-seed default menus from user design if collection is empty
  async seedDefaults() {
    const existing = await NavigationMenu.countDocuments({ isDeleted: false });
    if (existing > 0) return;

    const categories = await Category.find({ isDeleted: false }).lean();
    const catMap = {};
    categories.forEach((c) => {
      catMap[c.name.toLowerCase()] = c._id;
    });

    const defaultMenus = [
      {
        title: 'Rings',
        navType: 'main',
        type: 'Category',
        categoryId: catMap['rings'] || null,
        status: 'active',
        order: 1,
        isMegaMenu: true,
        image: { url: '/products/ring_catalog.jpg' },
        sections: [
          {
            title: 'Featured',
            icon: 'star',
            order: 1,
            status: 'active',
            items: [
              { title: 'Best Sellers', linkType: 'Category', order: 1, status: 'active' },
              { title: 'New Arrivals', linkType: 'Category', order: 2, status: 'active' },
              { title: 'Solitaire Rings', linkType: 'Category', order: 3, status: 'active' },
              { title: 'Engagement Rings', linkType: 'Category', order: 4, status: 'active' },
            ],
          },
          {
            title: 'Solitaire Rings',
            icon: 'diamond',
            order: 2,
            status: 'active',
            items: [
              { title: 'Classic Solitaire', linkType: 'Category', order: 1, status: 'active' },
              { title: 'Halo Solitaire', linkType: 'Category', order: 2, status: 'active' },
              { title: 'Six-Prong Crown', linkType: 'Category', order: 3, status: 'active' },
              { title: 'Cathedral Setting', linkType: 'Category', order: 4, status: 'active' },
              { title: 'Bezel Set Solitaire', linkType: 'Category', order: 5, status: 'active' },
            ],
          },
          {
            title: 'Three Stone Rings',
            icon: 'ring',
            order: 3,
            status: 'active',
            items: [
              { title: 'Trilogy Diamonds', linkType: 'Category', order: 1, status: 'active' },
              { title: 'Round & Baguettes', linkType: 'Category', order: 2, status: 'active' },
              { title: 'Emerald Center Trilogy', linkType: 'Category', order: 3, status: 'active' },
              { title: 'Vintage Past Present Future', linkType: 'Category', order: 4, status: 'active' },
            ],
          },
          {
            title: 'Wedding Bands',
            icon: 'band',
            order: 4,
            status: 'active',
            items: [
              { title: 'Classic Gold Bands', linkType: 'Category', order: 1, status: 'active' },
              { title: 'Diamond Pavé Bands', linkType: 'Category', order: 2, status: 'active' },
              { title: 'Full Eternity Bands', linkType: 'Category', order: 3, status: 'active' },
              { title: 'Curved Stacking Bands', linkType: 'Category', order: 4, status: 'active' },
              { title: 'Men’s Platinum Bands', linkType: 'Category', order: 5, status: 'active' },
            ],
          },
          {
            title: 'Cocktail Rings',
            icon: 'gem',
            order: 5,
            status: 'active',
            items: [
              { title: 'Royal Cluster Rings', linkType: 'Category', order: 1, status: 'active' },
              { title: 'Art Deco Statement', linkType: 'Category', order: 2, status: 'active' },
              { title: 'Floral Diamond Rings', linkType: 'Category', order: 3, status: 'active' },
              { title: 'Geometric Baguette Bands', linkType: 'Category', order: 4, status: 'active' },
              { title: 'Halo Cushion Cocktails', linkType: 'Category', order: 5, status: 'active' },
              { title: 'High Jewelry Specials', linkType: 'Category', order: 6, status: 'active' },
            ],
          },
        ],
        banners: [
          {
            title: 'Diamond Rings',
            subtitle: 'Timeless Brilliance',
            image: { url: '/products/ring_catalog.jpg' },
            linkType: 'Category',
            categoryId: catMap['rings'] || null,
            categoryName: 'Diamond Rings',
            status: 'active',
            order: 1,
          },
          {
            title: 'Wedding Bands',
            subtitle: 'For Every Story',
            image: { url: '/products/ring_side.jpg' },
            linkType: 'Category',
            categoryId: catMap['rings'] || null,
            categoryName: 'Wedding Bands',
            status: 'active',
            order: 2,
          },
        ],
      },
      {
        title: 'Earrings',
        navType: 'main',
        type: 'Category',
        categoryId: catMap['earrings'] || null,
        status: 'active',
        order: 2,
        isMegaMenu: true,
        image: { url: '/featured/earring.jpg' },
        sections: [
          {
            title: 'Daily Wear Studs',
            icon: 'star',
            order: 1,
            status: 'active',
            items: [
              { title: 'Solitaire Studs', linkType: 'Category', order: 1, status: 'active' },
              { title: 'Floral Studs', linkType: 'Category', order: 2, status: 'active' },
              { title: 'Halo Diamond Studs', linkType: 'Category', order: 3, status: 'active' },
            ],
          },
          {
            title: 'Hoops & Huggies',
            icon: 'ring',
            order: 2,
            status: 'active',
            items: [
              { title: 'Diamond Huggies', linkType: 'Category', order: 1, status: 'active' },
              { title: 'Inside-Out Diamond Hoops', linkType: 'Category', order: 2, status: 'active' },
              { title: 'Mini Gold Everyday Hoops', linkType: 'Category', order: 3, status: 'active' },
            ],
          },
          {
            title: 'Drops & Danglers',
            icon: 'gem',
            order: 3,
            status: 'active',
            items: [
              { title: 'Chandelier Drop Earrings', linkType: 'Category', order: 1, status: 'active' },
              { title: 'Tassel Diamond Drops', linkType: 'Category', order: 2, status: 'active' },
              { title: 'Pear-Shaped Solitaire Danglers', linkType: 'Category', order: 3, status: 'active' },
            ],
          },
          {
            title: 'Ear Cuffs & Climbers',
            icon: 'diamond',
            order: 4,
            status: 'active',
            items: [
              { title: 'Diamond Ear Climbers', linkType: 'Category', order: 1, status: 'active' },
              { title: 'Cartilage Diamond Cuffs', linkType: 'Category', order: 2, status: 'active' },
            ],
          },
        ],
        banners: [
          {
            title: 'Solitaire Studs',
            subtitle: 'Iconic Elegance',
            image: { url: '/featured/earring.jpg' },
            linkType: 'Category',
            status: 'active',
            order: 1,
          },
        ],
      },
      {
        title: 'Pendant',
        navType: 'main',
        type: 'Category',
        categoryId: catMap['pendant & necklaces'] || null,
        status: 'active',
        order: 3,
        isMegaMenu: true,
        image: { url: '/featured/necklace.jpg' },
        sections: [
          {
            title: 'Solitaire Pendants',
            icon: 'star',
            order: 1,
            status: 'active',
            items: [
              { title: 'Round Brilliant Pendants', linkType: 'Category', order: 1, status: 'active' },
              { title: 'Heart Solitaire Pendants', linkType: 'Category', order: 2, status: 'active' },
              { title: 'Emerald Cut Pendants', linkType: 'Category', order: 3, status: 'active' },
            ],
          },
          {
            title: 'Luxury Necklaces',
            icon: 'gem',
            order: 2,
            status: 'active',
            items: [
              { title: 'Tennis Necklaces', linkType: 'Category', order: 1, status: 'active' },
              { title: 'Bridal Diamond Chokers', linkType: 'Category', order: 2, status: 'active' },
            ],
          },
          {
            title: 'Modern Mangalsutra',
            icon: 'diamond',
            order: 3,
            status: 'active',
            items: [
              { title: 'Everyday Diamond Mangalsutra', linkType: 'Category', order: 1, status: 'active' },
              { title: 'Solitaire Drop Mangalsutra', linkType: 'Category', order: 2, status: 'active' },
            ],
          },
          {
            title: 'Personalized & Zodiac',
            icon: 'ring',
            order: 4,
            status: 'active',
            items: [
              { title: 'Diamond Initial Charms', linkType: 'Category', order: 1, status: 'active' },
              { title: 'Constellation Pendants', linkType: 'Category', order: 2, status: 'active' },
            ],
          },
        ],
        banners: [
          {
            title: 'Tennis Necklaces',
            subtitle: 'Red Carpet Statement',
            image: { url: '/featured/necklace.jpg' },
            linkType: 'Category',
            status: 'active',
            order: 1,
          },
        ],
      },
      {
        title: 'Bangles & Bracelets',
        navType: 'main',
        type: 'Category',
        categoryId: catMap['bangles & bracelets'] || null,
        status: 'active',
        order: 4,
        isMegaMenu: true,
        image: { url: '/featured/bangles.jpg' },
        sections: [
          {
            title: 'Tennis Bracelets',
            icon: 'star',
            order: 1,
            status: 'active',
            items: [
              { title: 'Classic Round Tennis', linkType: 'Category', order: 1, status: 'active' },
              { title: 'Baguette Diamond Tennis', linkType: 'Category', order: 2, status: 'active' },
            ],
          },
          {
            title: 'Bangles & Kadas',
            icon: 'ring',
            order: 2,
            status: 'active',
            items: [
              { title: 'Diamond Open Cuffs', linkType: 'Category', order: 1, status: 'active' },
              { title: 'Handcrafted Heritage Bangles', linkType: 'Category', order: 2, status: 'active' },
            ],
          },
          {
            title: 'Chain & Charm Bracelets',
            icon: 'gem',
            order: 3,
            status: 'active',
            items: [
              { title: 'Delicate Evil Eye Bracelets', linkType: 'Category', order: 1, status: 'active' },
              { title: 'Stackable Gold Bracelets', linkType: 'Category', order: 2, status: 'active' },
            ],
          },
          {
            title: 'Men’s Bracelets',
            icon: 'diamond',
            order: 4,
            status: 'active',
            items: [
              { title: 'Platinum & Gold Kadas', linkType: 'Category', order: 1, status: 'active' },
              { title: 'Heavy Diamond Curb Links', linkType: 'Category', order: 2, status: 'active' },
            ],
          },
        ],
        banners: [
          {
            title: 'Tennis Bracelets',
            subtitle: 'Continuous Luxury',
            image: { url: '/featured/bangles.jpg' },
            linkType: 'Category',
            status: 'active',
            order: 1,
          },
        ],
      },
      {
        title: 'Collection',
        navType: 'main',
        type: 'Custom Link',
        customUrl: '/collections',
        status: 'active',
        order: 5,
        isMegaMenu: false,
        image: { url: '/featured/ring.jpg' },
        sections: [],
        banners: [],
      },
      {
        title: 'Silver Collection',
        navType: 'main',
        type: 'Category',
        categoryId: catMap['silver collection'] || null,
        status: 'active',
        order: 6,
        isMegaMenu: true,
        image: { url: '/products/ring_front.jpg' },
        sections: [
          {
            title: '925 Silver Rings',
            icon: 'star',
            order: 1,
            status: 'active',
            items: [
              { title: 'Solitaire Silver Rings', linkType: 'Category', order: 1, status: 'active' },
              { title: 'Adjustable Silver Bands', linkType: 'Category', order: 2, status: 'active' },
            ],
          },
          {
            title: 'Silver Pendants',
            icon: 'gem',
            order: 2,
            status: 'active',
            items: [
              { title: 'Minimalist Neckpieces', linkType: 'Category', order: 1, status: 'active' },
              { title: 'Oxidised Silver Chokers', linkType: 'Category', order: 2, status: 'active' },
            ],
          },
          {
            title: 'Silver Dailywear',
            icon: 'diamond',
            order: 3,
            status: 'active',
            items: [
              { title: 'Silver Studs & Hoops', linkType: 'Category', order: 1, status: 'active' },
              { title: 'Silver Anklets & Bracelets', linkType: 'Category', order: 2, status: 'active' },
            ],
          },
        ],
        banners: [],
      },
      // ─── Footer Navigation ────────────────────────
      {
        title: 'Engagement & Bridal',
        navType: 'footer',
        type: 'Category',
        status: 'active',
        order: 1,
        isMegaMenu: false,
      },
      {
        title: 'Conflict-Free Diamonds',
        navType: 'footer',
        type: 'Custom Link',
        customUrl: '/about-diamonds',
        status: 'active',
        order: 2,
        isMegaMenu: false,
      },
      {
        title: 'Bespoke Design Studio',
        navType: 'footer',
        type: 'Custom Link',
        customUrl: '/custom-inquiries',
        status: 'active',
        order: 3,
        isMegaMenu: false,
      },
      {
        title: 'Store Appointments',
        navType: 'footer',
        type: 'Custom Link',
        customUrl: '/appointments',
        status: 'active',
        order: 4,
        isMegaMenu: false,
      },
      // ─── Utility Links ────────────────────────────
      {
        title: 'Track Order',
        navType: 'utility',
        type: 'Custom Link',
        customUrl: '/orders/track',
        status: 'active',
        order: 1,
        isMegaMenu: false,
      },
      {
        title: 'Book Virtual Consultation',
        navType: 'utility',
        type: 'Custom Link',
        customUrl: '/appointments',
        status: 'active',
        order: 2,
        isMegaMenu: false,
      },
      {
        title: 'Jewelry Care Guide',
        navType: 'utility',
        type: 'Custom Link',
        customUrl: '/care-guide',
        status: 'active',
        order: 3,
        isMegaMenu: false,
      },
    ];

    await NavigationMenu.insertMany(defaultMenus);
  }

  // ------------------------------- get all navigation menus ----------------------------
  async getAll(queryParams = {}) {
    await this.seedDefaults();

    const filter = { isDeleted: false };
    if (queryParams.navType && queryParams.navType !== 'all') {
      filter.navType = queryParams.navType;
    }
    if (queryParams.status) {
      filter.status = queryParams.status;
    }
    if (queryParams.search) {
      filter.title = new RegExp(queryParams.search, 'i');
    }

    const items = await NavigationMenu.find(filter)
      .populate('categoryId', 'name slug type')
      .sort({ order: 1, 'meta.createdAt': 1 })
      .lean();

    return items;
  }

  // ------------------------------- get one navigation menu ----------------------------
  async getOne(id) {
    const item = await NavigationMenu.findOne({ _id: id, isDeleted: false })
      .populate('categoryId', 'name slug type')
      .lean();

    if (!item) {
      throw new ApiError(404, 'Navigation menu not found');
    }
    return item;
  }

  // ------------------------------- create navigation menu ----------------------------
  async create(data) {
    if (!data.order) {
      const highest = await NavigationMenu.findOne({ navType: data.navType || 'main', isDeleted: false })
        .sort({ order: -1 })
        .select('order');
      data.order = (highest?.order || 0) + 1;
    }
    return await NavigationMenu.create(data);
  }

  // ------------------------------- update navigation menu ----------------------------
  async update(id, data) {
    const item = await NavigationMenu.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    ).populate('categoryId', 'name slug type');

    if (!item) {
      throw new ApiError(404, 'Navigation menu not found');
    }
    return item;
  }

  // ------------------------------- delete navigation menu ----------------------------
  async delete(id) {
    const item = await NavigationMenu.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, status: 'inactive' } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'Navigation menu not found');
    }
    return { message: 'Navigation menu deleted successfully', id };
  }

  // ------------------------------- reorder navigation menus ----------------------------
  async reorder(orderedIds = []) {
    const bulkOps = orderedIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { order: index + 1 } },
      },
    }));

    if (bulkOps.length > 0) {
      await NavigationMenu.bulkWrite(bulkOps);
    }
    return { success: true };
  }

  // ------------------------------- sections management ----------------------------
  async addSection(menuId, sectionData) {
    const menu = await NavigationMenu.findOne({ _id: menuId, isDeleted: false });
    if (!menu) throw new ApiError(404, 'Navigation menu not found');

    if (!sectionData.order) {
      sectionData.order = (menu.sections?.length || 0) + 1;
    }

    menu.sections.push(sectionData);
    await menu.save();
    return menu;
  }

  async updateSection(menuId, sectionId, sectionData) {
    const menu = await NavigationMenu.findOne({ _id: menuId, isDeleted: false });
    if (!menu) throw new ApiError(404, 'Navigation menu not found');

    const section = menu.sections.id(sectionId);
    if (!section) throw new ApiError(404, 'Menu section not found');

    Object.assign(section, sectionData);
    await menu.save();
    return menu;
  }

  async deleteSection(menuId, sectionId) {
    const menu = await NavigationMenu.findOne({ _id: menuId, isDeleted: false });
    if (!menu) throw new ApiError(404, 'Navigation menu not found');

    menu.sections.pull({ _id: sectionId });
    await menu.save();
    return menu;
  }

  // ------------------------------- section items management ----------------------------
  async addMenuItem(menuId, sectionId, itemData) {
    const menu = await NavigationMenu.findOne({ _id: menuId, isDeleted: false });
    if (!menu) throw new ApiError(404, 'Navigation menu not found');

    const section = menu.sections.id(sectionId);
    if (!section) throw new ApiError(404, 'Menu section not found');

    if (!itemData.order) {
      itemData.order = (section.items?.length || 0) + 1;
    }

    section.items.push(itemData);
    await menu.save();
    return menu;
  }

  async updateMenuItem(menuId, sectionId, itemId, itemData) {
    const menu = await NavigationMenu.findOne({ _id: menuId, isDeleted: false });
    if (!menu) throw new ApiError(404, 'Navigation menu not found');

    const section = menu.sections.id(sectionId);
    if (!section) throw new ApiError(404, 'Menu section not found');

    const item = section.items.id(itemId);
    if (!item) throw new ApiError(404, 'Menu item not found');

    Object.assign(item, itemData);
    await menu.save();
    return menu;
  }

  async deleteMenuItem(menuId, sectionId, itemId) {
    const menu = await NavigationMenu.findOne({ _id: menuId, isDeleted: false });
    if (!menu) throw new ApiError(404, 'Navigation menu not found');

    const section = menu.sections.id(sectionId);
    if (!section) throw new ApiError(404, 'Menu section not found');

    section.items.pull({ _id: itemId });
    await menu.save();
    return menu;
  }

  // ------------------------------- banners management ----------------------------
  async addBanner(menuId, bannerData) {
    const menu = await NavigationMenu.findOne({ _id: menuId, isDeleted: false });
    if (!menu) throw new ApiError(404, 'Navigation menu not found');

    if (!bannerData.order) {
      bannerData.order = (menu.banners?.length || 0) + 1;
    }

    menu.banners.push(bannerData);
    await menu.save();
    return menu;
  }

  async updateBanner(menuId, bannerId, bannerData) {
    const menu = await NavigationMenu.findOne({ _id: menuId, isDeleted: false });
    if (!menu) throw new ApiError(404, 'Navigation menu not found');

    const banner = menu.banners.id(bannerId);
    if (!banner) throw new ApiError(404, 'Banner not found');

    Object.assign(banner, bannerData);
    await menu.save();
    return menu;
  }

  async deleteBanner(menuId, bannerId) {
    const menu = await NavigationMenu.findOne({ _id: menuId, isDeleted: false });
    if (!menu) throw new ApiError(404, 'Navigation menu not found');

    menu.banners.pull({ _id: bannerId });
    await menu.save();
    return menu;
  }
}

module.exports = new NavigationMenuService();
