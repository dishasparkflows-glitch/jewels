const StaticPage = require('./staticPage.model');
const ApiError = require('../../utils/ApiError');

class StaticPageService {
  _normalizeSlug(slug, title) {
    const raw = slug || title || '';
    return raw
      .toLowerCase()
      .trim()
      .replace(/^\/+|\/+$/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // ------------------------------- get all static pages ----------------------------
  async getAll(query = {}) {
    const filter = {};
    if (query.search) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { title: searchRegex },
        { slug: searchRegex },
        { 'seo.metaTitle': searchRegex },
        { 'seo.keywords': searchRegex },
      ];
    }
    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }

    return await StaticPage.find(filter).sort({ order: 1, 'meta.updatedAt': -1 }).lean();
  }

  // ------------------------------- get single static page ----------------------------
  async getOne(id) {
    const page = await StaticPage.findById(id).lean();
    if (!page) {
      throw new ApiError(404, 'Static page not found');
    }
    return page;
  }

  // ------------------------------- get static page by slug ----------------------------
  async getBySlug(rawSlug) {
    const slug = this._normalizeSlug(rawSlug);
    const page = await StaticPage.findOne({
      slug,
      status: { $in: ['published', 'active'] },
    }).lean();

    if (!page) {
      throw new ApiError(404, `Page with slug '${slug}' not found`);
    }
    return page;
  }

  // ------------------------------- create static page ----------------------------
  async create(data) {
    const payload = { ...data };
    payload.slug = this._normalizeSlug(payload.slug, payload.title);

    if (!payload.slug) {
      throw new ApiError(400, 'Please provide a valid page title or URL slug');
    }

    // Check slug uniqueness
    const existing = await StaticPage.findOne({ slug: payload.slug });
    if (existing) {
      throw new ApiError(400, `A page with URL slug '/${payload.slug}' already exists`);
    }

    return await StaticPage.create(payload);
  }

  // ------------------------------- update static page ----------------------------
  async update(id, data) {
    const page = await StaticPage.findById(id);
    if (!page) {
      throw new ApiError(404, 'Static page not found');
    }

    const payload = { ...data };
    if (payload.slug) {
      payload.slug = this._normalizeSlug(payload.slug, payload.title);
      // Check duplicate slug if slug changed
      if (payload.slug !== page.slug) {
        const existing = await StaticPage.findOne({ slug: payload.slug, _id: { $ne: id } });
        if (existing) {
          throw new ApiError(400, `A page with URL slug '/${payload.slug}' already exists`);
        }
      }
    }

    Object.assign(page, payload);
    await page.save();
    return page;
  }

    // ------------------------------- delete static page ----------------------------
  async delete(id) {
    const page = await StaticPage.findByIdAndDelete(id);
    if (!page) {
      throw new ApiError(404, 'Static page not found');
    }
    return { id, message: 'Static page deleted successfully' };
  }

  // ------------------------------- bulk delete static pages ----------------------------
  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, 'Please provide an array of page IDs to delete');
    }

    const result = await StaticPage.deleteMany({ _id: { $in: ids } });

    return {
      message: `${result.deletedCount} static page(s) deleted successfully`,
      deletedCount: result.deletedCount,
      ids,
    };
  }
}

module.exports = new StaticPageService();
