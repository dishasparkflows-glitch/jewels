const Category = require('./category.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class CategoryService {
  _normalizePayload(data) {
    const payload = { ...data };
    if (typeof payload.icon === 'string') {
      payload.icon = { url: payload.icon.trim(), key: '' };
    }
    if (typeof payload.banner === 'string') {
      payload.banner = { url: payload.banner.trim(), key: '' };
    }
    if (Array.isArray(payload.promoBanners)) {
      payload.promoBanners = payload.promoBanners.map((item) => {
        if (typeof item === 'string') {
          return {
            title: '',
            image: { url: item.trim(), key: '' },
            url: item.trim(),
            link: '',
            subtitle: '',
            status: 'active',
            order: 0,
          };
        }
        const itemUrl = item.image?.url || item.url || '';
        return {
          title: item.title || '',
          image: {
            url: typeof item.image === 'string' ? item.image.trim() : (item.image?.url || itemUrl || ''),
            key: item.image?.key || item.key || '',
          },
          url: itemUrl,
          link: item.link || '',
          subtitle: item.subtitle || '',
          status: item.status || 'active',
          order: Number(item.order) || 0,
        };
      });
    }
    return payload;
  }

  // ------------------------------- create category ----------------------------
  async create(data) {
    const payload = this._normalizePayload(data);
    return await Category.create(payload);
  }

  // ------------------------------- get one category ----------------------------
  async getOne(id) {
    const item = await Category.findOne({ _id: id });
    if (!item) {
      throw new ApiError(404, 'Category not found');
    }
    return item;
  }

  // ------------------------------- get all categories ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };


    if (queryParams.status) {
      filter.status = queryParams.status;
    }
    if (queryParams.search) {
      filter.name = new RegExp(queryParams.search, 'i');
    }

    const [items, total] = await Promise.all([
      Category.find(filter)
        .sort({ 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Category.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get category lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { 'meta.deletedAt': null };
    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    return await Category.find(filter)
      .select('_id name status icon')
      .sort({ name: 1 })
      .lean();
  }

  // ------------------------------- update category ----------------------------
  async update(id, data) {
    const payload = this._normalizePayload(data);
    const item = await Category.findOneAndUpdate(
      { _id: id },
      { $set: payload },
      { new: true, runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Category not found');
    }

    return item;
  }

  // ------------------------------- delete category ----------------------------
  async delete(id) {
    const item = await Category.findOneAndUpdate(
      { _id: id },
      { $set: { status: 'inactive', 'meta.deletedAt': new Date() } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'Category not found');
    }

    return { message: 'Category deleted successfully', id };
  }
}

module.exports = new CategoryService();
