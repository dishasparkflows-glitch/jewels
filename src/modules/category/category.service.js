const Category = require('./category.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class CategoryService {
  _normalizePayload(data) {
    const payload = { ...data };
    if (typeof payload.icon === 'string') {
      payload.icon = { url: payload.icon.trim(), public_id: '' };
    }
    if (typeof payload.banner === 'string') {
      payload.banner = { url: payload.banner.trim(), public_id: '' };
    }
    // Also if slug is not given, generate it from name
    if (!payload.slug && payload.name) {
      payload.slug = payload.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }
    // Handle promoBanners / prompbanners array
    const promoList = payload.promoBanners || payload.prompbanners || payload.promoBanner;
    if (Array.isArray(promoList)) {
      const normalizedPromos = promoList.map((item) => {
        if (typeof item === 'string') {
          return {
            title: '',
            image: { url: item.trim(), public_id: '' },
          };
        }
        return {
          title: item.title || '',
          image:
            typeof item.image === 'string'
              ? { url: item.image.trim(), public_id: '' }
              : item.image?.url
              ? { url: item.image.url.trim(), public_id: item.image.public_id || '' }
              : { url: item.url || '', public_id: item.public_id || '' },
          link: item.link || '',
          subtitle: item.subtitle || '',
          status: item.status || 'active',
          order: Number(item.order) || 0,
        };
      });
      payload.promoBanners = normalizedPromos;
      payload.prompbanners = normalizedPromos;
    }
    // Keep images array in sync for backward compatibility
    if (!payload.images || payload.images.length === 0) {
      if (payload.banner?.url) {
        payload.images = [{ url: payload.banner.url, title: payload.name || 'Banner' }];
      } else if (payload.icon?.url) {
        payload.images = [{ url: payload.icon.url, title: payload.name || 'Icon' }];
      }
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
    const item = await Category.findOne({ _id: id, isDeleted: false });
    if (!item) {
      throw new ApiError(404, 'Category not found');
    }
    return item;
  }

  // ------------------------------- get all categories ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { isDeleted: false };

    if (queryParams.type) {
      filter.type = queryParams.type;
    }
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
    const filter = { isDeleted: false, status: 'active' };

    if (queryParams.type) {
      filter.type = queryParams.type;
    }

    return await Category.find(filter)
      .select('_id name banner icon images promoBanners prompbanners type slug')
      .sort({ name: 1 })
      .lean();
  }

  // ------------------------------- update category ----------------------------
  async update(id, data) {
    const payload = this._normalizePayload(data);
    const item = await Category.findOneAndUpdate(
      { _id: id, isDeleted: false },
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
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, status: 'inactive' } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'Category not found');
    }

    return { message: 'Category deleted successfully', id };
  }
}

module.exports = new CategoryService();
