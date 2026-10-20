const BlogCategory = require('./blogCategory.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class BlogCategoryService {
  /**
   * Create blog category
   */
  async create(data) {
    if (!data.slug && data.name) {
      data.slug = data.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    const existing = await BlogCategory.findOne({
      $or: [{ name: new RegExp(`^${data.name.trim()}$`, 'i') }, { slug: data.slug }],
      'meta.deletedAt': null,
    });

    if (existing) {
      throw new ApiError(409, `A blog category with name "${data.name}" or slug "${data.slug}" already exists`);
    }

    return await BlogCategory.create(data);
  }

  /**
   * Get single blog category by ID
   */
  async getOne(id) {
    const item = await BlogCategory.findOne({ _id: id, 'meta.deletedAt': null });
    if (!item) {
      throw new ApiError(404, 'Blog category not found');
    }
    return item;
  }

  /**
   * Get category by slug
   */
  async getBySlug(slug) {
    const item = await BlogCategory.findOne({ slug, 'meta.deletedAt': null });
    if (!item) {
      throw new ApiError(404, 'Blog category not found');
    }
    return item;
  }

  /**
   * Get all blog categories
   */
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    if (queryParams.search) {
      const searchRegex = new RegExp(queryParams.search, 'i');
      filter.$or = [{ name: searchRegex }, { slug: searchRegex }, { description: searchRegex }];
    }

    const [items, total] = await Promise.all([
      BlogCategory.find(filter)
        .sort({ order: 1, 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BlogCategory.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  /**
   * Lookup list of active categories
   */
  async getLookup() {
    return await BlogCategory.find({ 'meta.deletedAt': null, status: 'active' })
      .select('_id name slug')
      .sort({ order: 1, name: 1 })
      .lean();
  }

  /**
   * Update blog category
   */
  async update(id, data) {
    if (data.name && !data.slug) {
      data.slug = data.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    if (data.name || data.slug) {
      const duplicateFilter = {
        _id: { $ne: id },
        'meta.deletedAt': null,
        $or: [],
      };
      if (data.name) duplicateFilter.$or.push({ name: new RegExp(`^${data.name.trim()}$`, 'i') });
      if (data.slug) duplicateFilter.$or.push({ slug: data.slug });

      const duplicate = await BlogCategory.findOne(duplicateFilter);
      if (duplicate) {
        throw new ApiError(409, 'Another blog category with this name or slug already exists');
      }
    }

    const item = await BlogCategory.findOneAndUpdate(
      { _id: id, 'meta.deletedAt': null },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Blog category not found');
    }

    return item;
  }

  /**
   * Soft delete blog category
   */
  async delete(id) {
    const item = await BlogCategory.findOneAndUpdate(
      { _id: id, 'meta.deletedAt': null },
      { $set: { status: 'inactive', 'meta.deletedAt': new Date() } },
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'Blog category not found');
    }

    return { message: 'Blog category deleted successfully', id };
  }
}

module.exports = new BlogCategoryService();
