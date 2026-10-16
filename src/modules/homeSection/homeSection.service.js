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
    });
    if (existing) {
      data.sectionKey = `${data.sectionKey}-${Date.now().toString().slice(-4)}`;
    }

    // Auto calculate order if not specified
    if (data.order === undefined || data.order === null || isNaN(data.order)) {
      const highest = await HomeSection.findOne({ 'meta.deletedAt': null })
        .sort({ order: -1 })
        .select('order')
        .lean();
      data.order = highest && highest.order !== undefined ? highest.order + 1 : 1;
    }

    return await HomeSection.create(data);
  }

  // ------------------------------- Get All (Admin with Pagination) ----------------------------
  async getAll(queryParams = {}) {

    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

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
    const filter = { 'meta.deletedAt': null, status: 'active' };

    if (queryParams.placement && queryParams.placement !== 'all') {
      filter.placement = { $in: [queryParams.placement, 'all'] };
    }

    if (queryParams.sectionType) {
      filter.sectionType = queryParams.sectionType;
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
    const section = await HomeSection.findOne({ _id: id })
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
    const section = await HomeSection.findOne({ _id: id });
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
    const section = await HomeSection.findOne({ _id: id });
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
    const section = await HomeSection.findOne({ _id: id });
    if (!section) {
      throw new ApiError(404, 'Home section not found');
    }

    section.meta = section.meta || {}; section.meta.deletedAt = new Date();
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
      { $set: { 'meta.deletedAt': new Date() } }
    );

    return { success: true, count: ids.length };
  }
}

module.exports = new HomeSectionService();

