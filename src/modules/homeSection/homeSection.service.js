const HomeSection = require('./homeSection.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class HomeSectionService {
  // ------------------------------- Create Home Section ----------------------------
  async create(data) {
    return await HomeSection.create(data);
  }

  // ------------------------------- Get All (Admin with Pagination) ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = {};

    if (queryParams.status && queryParams.status !== 'all') {
      filter.status = queryParams.status;
    }

    if (queryParams.search) {
      const searchRegex = new RegExp(queryParams.search.trim(), 'i');
      filter.$or = [
        { title: searchRegex },
        { subtitle: searchRegex },
        { slug: searchRegex },
      ];
    }

    const [items, total] = await Promise.all([
      HomeSection.find(filter)
        .populate('productIds', '_id basicInfo pricing images colorImages title sku slug productType')
        .sort({ order: 1, _id: 1 })
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

  // ------------------------------- Get One By ID ----------------------------
  async getOne(id) {
    const section = await HomeSection.findById(id)
      .populate('productIds', '_id basicInfo pricing images colorImages title sku productType')
      .lean();

    if (!section) {
      throw new ApiError(404, 'Home section not found');
    }
    return section;
  }

  // ------------------------------- Update ----------------------------
  async update(id, data) {
    const section = await HomeSection.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!section) {
      throw new ApiError(404, 'Home section not found');
    }
    return section;
  }

  // ------------------------------- Toggle Status ----------------------------
  async toggleStatus(id) {
    const section = await HomeSection.findById(id);
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

  // ------------------------------- Delete ----------------------------
  async delete(id) {
    const section = await HomeSection.findByIdAndDelete(id);
    if (!section) {
      throw new ApiError(404, 'Home section not found');
    }
    return { id, message: 'Home section deleted successfully' };
  }

  // ------------------------------- Bulk Delete ----------------------------
  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, 'Array of IDs is required for bulk delete');
    }

    const result = await HomeSection.deleteMany({ _id: { $in: ids } });
    return { success: true, count: result.deletedCount };
  }
}

module.exports = new HomeSectionService();
