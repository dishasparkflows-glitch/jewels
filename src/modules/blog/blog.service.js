const Blog = require('./blog.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class BlogService {
    // ------------------------------- create blog post ----------------------------
  async create(data) {
    if (data.basicInfo?.slug) {
      const existing = await Blog.findOne({
        'basicInfo.slug': data.basicInfo.slug,
        'meta.deletedAt': null,
      });

      if (existing) {
        data.basicInfo.slug = `${data.basicInfo.slug}-${Date.now().toString().slice(-4)}`;
      }
    }

    const item = await Blog.create(data);
    return await Blog.findById(item._id).populate('blogCategory', 'name slug').lean();
  }

    // ------------------------------- get single blog post ----------------------------
  async getOne(id) {
    const item = await Blog.findOne({ _id: id, 'meta.deletedAt': null })
      .populate('blogCategory', 'name slug')
      .lean();
    if (!item) {
      throw new ApiError(404, 'Blog post not found');
    }
    return item;
  }

    // ------------------------------- get blog post by slug ----------------------------
  async getBySlug(slug) {
    const item = await Blog.findOneAndUpdate(
      { 'basicInfo.slug': slug, 'meta.deletedAt': null },
      { $inc: { views: 1 } },
      { returnDocument: 'after' }
    )
      .populate('blogCategory', 'name slug')
      .lean();

    if (!item) {
      throw new ApiError(404, 'Blog post not found');
    }
    return item;
  }

    // ------------------------------- get all blog posts ----------------------------
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
        { 'basicInfo.title': searchRegex },
        { 'basicInfo.slug': searchRegex },
        { 'basicInfo.shortDescription': searchRegex },
        { 'basicInfo.description': searchRegex },
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

    // ------------------------------- get recent blog posts ----------------------------
  async getRecent(limit = 4) {
    const count = parseInt(limit, 10) || 4;
    return await Blog.find({ 'meta.deletedAt': null, status: 'active' })
      .populate('blogCategory', 'name slug')
      .sort({ 'meta.createdAt': -1 })
      .limit(count)
      .lean();
  }

    // ------------------------------- update blog post ----------------------------
  async update(id, data) {
    if (data.basicInfo?.slug) {
      const duplicate = await Blog.findOne({
        _id: { $ne: id },
        'basicInfo.slug': data.basicInfo.slug,
        'meta.deletedAt': null,
      });
      if (duplicate) {
        data.basicInfo.slug = `${data.basicInfo.slug}-${Date.now().toString().slice(-4)}`;
      }
    }

    const item = await Blog.findOneAndUpdate(
      { _id: id, 'meta.deletedAt': null },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    )
      .populate('blogCategory', 'name slug')
      .lean();

    if (!item) {
      throw new ApiError(404, 'Blog post not found');
    }

    return item;
  }

    // ------------------------------- delete blog post ----------------------------
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
