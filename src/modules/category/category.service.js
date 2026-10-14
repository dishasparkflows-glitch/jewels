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
    const promoList = payload.promoBanner || payload.promoBanners || payload.prompbanners;
    if (Array.isArray(promoList)) {
      const normalizedPromos = promoList.map((item) => {
        if (typeof item === 'string') {
          return {
            title: '',
            image: { url: item.trim(), public_id: '' },
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
            public_id: item.image?.public_id || item.public_id || '',
          },
          url: itemUrl,
          link: item.link || '',
          subtitle: item.subtitle || '',
          status: item.status || 'active',
          order: Number(item.order) || 0,
        };
      });
      payload.promoBanner = normalizedPromos;
      payload.promoBanners = normalizedPromos;
      payload.prompbanners = normalizedPromos;
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
      .select('_id name banner icon images subTypes promoBanner promoBanners type slug')
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
