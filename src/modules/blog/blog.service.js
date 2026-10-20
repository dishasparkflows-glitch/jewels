const Blog = require('./blog.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class BlogService {
  /**
   * Helper to normalize input fields
   */
  _normalizeBlogData(data) {
    const payload = { ...data };

    // Support both blogcategory and blogCategory
    if (payload.blogcategory && !payload.blogCategory) {
      payload.blogCategory = payload.blogcategory;
      delete payload.blogcategory;
    }
    if (payload.categoryId && !payload.blogCategory) {
      payload.blogCategory = payload.categoryId;
      delete payload.categoryId;
    }

    // Support image as string URL or object
    if (typeof payload.image === 'string') {
      payload.image = { url: payload.image, key: '' };
    }

    // Auto-generate slug if missing
    if (!payload.slug && payload.title) {
      payload.slug = payload.title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    // Auto calculate readTime if missing
    if ((!payload.readTime || !payload.readTime.trim()) && payload.description) {
      const plainText = payload.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const words = plainText ? plainText.split(/\s+/).length : 0;
      const mins = Math.max(1, Math.ceil(words / 200));
      payload.readTime = `${mins} min read`;
    }

    // Auto generate short description if missing
    if (!payload.shortDescription && payload.description) {
      const plainText = payload.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      payload.shortDescription = plainText.length > 160 ? plainText.substring(0, 157) + '...' : plainText;
    }

    return payload;
  }

  /**
   * Create blog
   */
  async create(rawData) {
    const data = this._normalizeBlogData(rawData);

    // Check slug uniqueness
    const existing = await Blog.findOne({
      slug: data.slug,
      'meta.deletedAt': null,
    });

    if (existing) {
      // Append random suffix to slug to make unique
      data.slug = `${data.slug}-${Date.now().toString().slice(-4)}`;
    }

    const item = await Blog.create(data);
    return await Blog.findById(item._id).populate('blogCategory', 'name slug');
  }

  /**
   * Get single blog by ID
   */
  async getOne(id) {
    const item = await Blog.findOne({ _id: id, 'meta.deletedAt': null }).populate(
      'blogCategory',
      'name slug'
    );
    if (!item) {
      throw new ApiError(404, 'Blog post not found');
    }
    return item;
  }

  /**
   * Get blog by Slug (public view)
   */
  async getBySlug(slug) {
    const item = await Blog.findOneAndUpdate(
      { slug, 'meta.deletedAt': null },
      { $inc: { views: 1 } },
      { returnDocument: 'after' }
    ).populate('blogCategory', 'name slug');

    if (!item) {
      throw new ApiError(404, 'Blog post not found');
    }
    return item;
  }

  /**
   * Get all blogs with filtering and pagination
   */
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    if (queryParams.blogCategory || queryParams.category) {
      filter.blogCategory = queryParams.blogCategory || queryParams.category;
    }

    if (queryParams.search) {
      const searchRegex = new RegExp(queryParams.search, 'i');
      filter.$or = [
        { title: searchRegex },
        { slug: searchRegex },
        { shortDescription: searchRegex },
        { description: searchRegex },
      ];
    }

    const [items, total] = await Promise.all([
      Blog.find(filter)
        .populate('blogCategory', 'name slug')
        .sort({ 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Blog.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  /**
   * Get recent active blogs (for widgets / sidebar / footer)
   */
  async getRecent(limit = 4) {
    const count = parseInt(limit, 10) || 4;
    return await Blog.find({ 'meta.deletedAt': null, status: 'active' })
      .populate('blogCategory', 'name slug')
      .sort({ 'meta.createdAt': -1 })
      .limit(count)
      .lean();
  }

  /**
   * Update blog
   */
  async update(id, rawData) {
    const data = this._normalizeBlogData(rawData);

    if (data.slug) {
      const duplicate = await Blog.findOne({
        _id: { $ne: id },
        slug: data.slug,
        'meta.deletedAt': null,
      });
      if (duplicate) {
        data.slug = `${data.slug}-${Date.now().toString().slice(-4)}`;
      }
    }

    const item = await Blog.findOneAndUpdate(
      { _id: id, 'meta.deletedAt': null },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    ).populate('blogCategory', 'name slug');

    if (!item) {
      throw new ApiError(404, 'Blog post not found');
    }

    return item;
  }

  /**
   * Soft delete blog
   */
  async delete(id) {
    const item = await Blog.findOneAndUpdate(
      { _id: id, 'meta.deletedAt': null },
      { $set: { status: 'inactive', 'meta.deletedAt': new Date() } },
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'Blog post not found');
    }

    return { message: 'Blog post deleted successfully', id };
  }
}

module.exports = new BlogService();
