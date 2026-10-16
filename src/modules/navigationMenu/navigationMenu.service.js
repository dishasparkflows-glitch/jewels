const NavigationMenu = require('./navigationMenu.model');
const ApiError = require('../../utils/ApiError');

class NavigationMenuService {
  // ------------------------------- get all navigation menus ----------------------------
  async getAll(queryParams = {}) {
    const filter = {};
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
      .populate('sections.items.categoryId', 'name slug status icon')
      .sort({ order: 1, 'meta.createdAt': 1 })
      .lean();

    return items;
  }

  // ------------------------------- get one navigation menu ----------------------------
  async getOne(id) {
    const item = await NavigationMenu.findOne({ _id: id })
      .populate('categoryId', 'name slug type')
      .populate('sections.items.categoryId', 'name slug status icon')
      .lean();

    if (!item) {
      throw new ApiError(404, 'Navigation menu not found');
    }
    return item;
  }

  // ------------------------------- create navigation menu ----------------------------
  async create(data) {
    if (!data.order) {
      const highest = await NavigationMenu.findOne({ navType: data.navType || 'main' })
        .sort({ order: -1 })
        .select('order');
      data.order = (highest?.order || 0) + 1;
    }
    const item = await NavigationMenu.create(data);
    return await NavigationMenu.findById(item._id)
      .populate('categoryId', 'name slug type')
      .populate('sections.items.categoryId', 'name slug status icon')
      .lean();
  }

  // ------------------------------- update navigation menu ----------------------------
  async update(id, data) {
    const item = await NavigationMenu.findOneAndUpdate(
      { _id: id },
      { $set: data },
      { new: true, runValidators: true }
    )
      .populate('categoryId', 'name slug type')
      .populate('sections.items.categoryId', 'name slug status icon')
      .lean();

    if (!item) {
      throw new ApiError(404, 'Navigation menu not found');
    }
    return item;
  }

  // ------------------------------- delete navigation menu ----------------------------
  async delete(id) {
    const item = await NavigationMenu.findOneAndUpdate(
      { _id: id },
      { $set: { status: 'inactive', 'meta.deletedAt': new Date() } },
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
    const menu = await NavigationMenu.findOne({ _id: menuId });
    if (!menu) throw new ApiError(404, 'Navigation menu not found');

    if (!sectionData.order) {
      sectionData.order = (menu.sections?.length || 0) + 1;
    }

    menu.sections.push(sectionData);
    await menu.save();
    return await NavigationMenu.findById(menuId)
      .populate('categoryId', 'name slug type')
      .populate('sections.items.categoryId', 'name slug status icon')
      .lean();
  }

  async updateSection(menuId, sectionId, sectionData) {
    const menu = await NavigationMenu.findOne({ _id: menuId });
    if (!menu) throw new ApiError(404, 'Navigation menu not found');

    const section = menu.sections.id(sectionId);
    if (!section) throw new ApiError(404, 'Menu section not found');

    Object.assign(section, sectionData);
    await menu.save();
    return await NavigationMenu.findById(menuId)
      .populate('categoryId', 'name slug type')
      .populate('sections.items.categoryId', 'name slug status icon')
      .lean();
  }

  async deleteSection(menuId, sectionId) {
    const menu = await NavigationMenu.findOne({ _id: menuId });
    if (!menu) throw new ApiError(404, 'Navigation menu not found');

    menu.sections.pull({ _id: sectionId });
    await menu.save();
    return await NavigationMenu.findById(menuId)
      .populate('categoryId', 'name slug type')
      .populate('sections.items.categoryId', 'name slug status icon')
      .lean();
  }

  async reorderSections(menuId, orderedSectionIds = []) {
    const menu = await NavigationMenu.findOne({ _id: menuId });
    if (!menu) throw new ApiError(404, 'Navigation menu not found');

    const sectionMap = new Map();
    menu.sections.forEach((sec) => sectionMap.set(String(sec._id), sec));

    const reordered = [];
    orderedSectionIds.forEach((id, idx) => {
      const sec = sectionMap.get(String(id));
      if (sec) {
        sec.order = idx + 1;
        reordered.push(sec);
        sectionMap.delete(String(id));
      }
    });
    sectionMap.forEach((sec) => {
      sec.order = reordered.length + 1;
      reordered.push(sec);
    });

    menu.sections = reordered;
    await menu.save();
    return await NavigationMenu.findById(menuId)
      .populate('categoryId', 'name slug type')
      .populate('sections.items.categoryId', 'name slug status icon')
      .lean();
  }

  // ------------------------------- section items management ----------------------------
  async addMenuItem(menuId, sectionId, itemData) {
    const menu = await NavigationMenu.findOne({ _id: menuId });
    if (!menu) throw new ApiError(404, 'Navigation menu not found');

    const targetSectionId = itemData.sectionId || sectionId;
    const section = menu.sections.id(targetSectionId);
    if (!section) throw new ApiError(404, 'Menu section not found');

    const cleanData = { ...itemData };
    delete cleanData.sectionId;

    if (!cleanData.order) {
      cleanData.order = (section.items?.length || 0) + 1;
    }

    section.items.push(cleanData);
    await menu.save();
    return await NavigationMenu.findById(menuId)
      .populate('categoryId', 'name slug type')
      .populate('sections.items.categoryId', 'name slug status icon')
      .lean();
  }

  async updateMenuItem(menuId, sectionId, itemId, itemData) {
    const menu = await NavigationMenu.findOne({ _id: menuId });
    if (!menu) throw new ApiError(404, 'Navigation menu not found');

    const newSectionId = itemData.sectionId || sectionId;
    const currentSection = menu.sections.id(sectionId);
    if (!currentSection) throw new ApiError(404, 'Current menu section not found');

    const item = currentSection.items.id(itemId);
    if (!item) throw new ApiError(404, 'Menu item not found');

    const cleanData = { ...itemData };
    delete cleanData.sectionId;

    if (String(newSectionId) !== String(sectionId)) {
      // Move item to different section
      const targetSection = menu.sections.id(newSectionId);
      if (!targetSection) throw new ApiError(404, 'Target menu section not found');

      const itemObj = item.toObject();
      Object.assign(itemObj, cleanData);
      currentSection.items.pull({ _id: itemId });
      targetSection.items.push(itemObj);
    } else {
      Object.assign(item, cleanData);
    }

    await menu.save();
    return await NavigationMenu.findById(menuId)
      .populate('categoryId', 'name slug type')
      .populate('sections.items.categoryId', 'name slug status icon')
      .lean();
  }

  async deleteMenuItem(menuId, sectionId, itemId) {
    const menu = await NavigationMenu.findOne({ _id: menuId });
    if (!menu) throw new ApiError(404, 'Navigation menu not found');

    const section = menu.sections.id(sectionId);
    if (!section) throw new ApiError(404, 'Menu section not found');

    section.items.pull({ _id: itemId });
    await menu.save();
    return await NavigationMenu.findById(menuId)
      .populate('categoryId', 'name slug type')
      .populate('sections.items.categoryId', 'name slug status icon')
      .lean();
  }

  async reorderMenuItems(menuId, sectionId, orderedItemIds = []) {
    const menu = await NavigationMenu.findOne({ _id: menuId });
    if (!menu) throw new ApiError(404, 'Navigation menu not found');

    const section = menu.sections.id(sectionId);
    if (!section) throw new ApiError(404, 'Menu section not found');

    const itemMap = new Map();
    section.items.forEach((it) => itemMap.set(String(it._id), it));

    const reordered = [];
    orderedItemIds.forEach((id, idx) => {
      const it = itemMap.get(String(id));
      if (it) {
        it.order = idx + 1;
        reordered.push(it);
        itemMap.delete(String(id));
      }
    });
    itemMap.forEach((it) => {
      it.order = reordered.length + 1;
      reordered.push(it);
    });

    section.items = reordered;
    await menu.save();
    return await NavigationMenu.findById(menuId)
      .populate('categoryId', 'name slug type')
      .populate('sections.items.categoryId', 'name slug status icon')
      .lean();
  }
}

module.exports = new NavigationMenuService();
