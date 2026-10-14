const NavigationMenu = require('./navigationMenu.model');
const ApiError = require('../../utils/ApiError');

class NavigationMenuService {
  // ------------------------------- get all navigation menus ----------------------------
  async getAll(queryParams = {}) {

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
}

module.exports = new NavigationMenuService();
