const Banner = require('./banner.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class BannerService {
  // Helper to normalize payload supporting both nested ({ content, display }) and legacy flat payloads
  _normalizePayload(data = {}) {
    const payload = { ...data };

    payload.content = {
      title: data.content?.title !== undefined ? data.content.title : (data.title || ''),
      subtitle: data.content?.subtitle !== undefined ? data.content.subtitle : (data.subtitle || ''),
      description: data.content?.description !== undefined ? data.content.description : (data.description || ''),
    };

    payload.display = {
      category: data.display?.category !== undefined ? data.display.category : data.category,
      type: data.display?.type !== undefined ? data.display.type : (data.type || 'herobanner'),
      position: data.display?.position !== undefined ? data.display.position : (data.position || 'none'),
      order:
        data.display?.order !== undefined
          ? Number(data.display.order)
          : data.order !== undefined
          ? Number(data.order)
          : 0,
    };

    // Remove legacy top-level duplicate keys to keep database documents clean
    delete payload.title;
    delete payload.subtitle;
    delete payload.description;
    delete payload.category;
    delete payload.type;
    delete payload.position;
    delete payload.order;

    return payload;
  }

  // Format banner document ensuring both nested { content, display } and top-level fallbacks exist
  _formatBanner(banner) {
    if (!banner) return null;
    const doc = banner.toObject ? banner.toObject({ virtuals: true }) : { ...banner };
    const title = doc.content?.title || doc.title || '';
    const subtitle = doc.content?.subtitle || doc.subtitle || '';
    const description = doc.content?.description || doc.description || '';
    const category = doc.display?.category || doc.category;
    const type = doc.display?.type || doc.type || 'herobanner';
    const position = doc.display?.position || doc.position || 'none';
    const order = doc.display?.order ?? doc.order ?? 0;

    return {
      ...doc,
      content: {
        title,
        subtitle,
        description,
      },
      display: {
        category,
        type,
        position,
        order,
      },
      // Top-level fallbacks for storefront backward compatibility
      title,
      subtitle,
      description,
      category,
      type,
      position,
      order,
    };
  }

  // ------------------------------- create banner ----------------------------
  async create(data) {
    const normalized = this._normalizePayload(data);
    const created = await Banner.create(normalized);
    const populated = await Banner.findById(created._id).populate('display.category', 'name slug');
    return this._formatBanner(populated);
  }

  // ------------------------------- get one banner ----------------------------
  async getOne(id) {
    const banner = await Banner.findOne({ _id: id, isDeleted: false }).populate('display.category', 'name slug');
    if (!banner) {
      throw new ApiError(404, 'Banner not found');
    }
    return this._formatBanner(banner);
  }

  // ------------------------------- get all banners ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { isDeleted: false };

    if (queryParams.type) {
      filter.$or = [
        { 'display.type': queryParams.type },
        { type: queryParams.type },
      ];
    }
    if (queryParams.status) {
      filter.status = queryParams.status;
    }
    if (queryParams.category) {
      filter.$or = [
        { 'display.category': queryParams.category },
        { category: queryParams.category },
      ];
    }
    if (queryParams.position && queryParams.position !== 'all') {
      filter.$or = [
        { 'display.position': queryParams.position },
        { position: queryParams.position },
      ];
    }
    if (queryParams.search) {
      const searchRegex = new RegExp(queryParams.search, 'i');
      filter.$or = [
        { 'content.title': searchRegex },
        { 'content.subtitle': searchRegex },
        { title: searchRegex },
        { 'display.position': searchRegex },
        { position: searchRegex },
      ];
    }

    const [items, total] = await Promise.all([
      Banner.find(filter)
        .populate('display.category', 'name slug')
        .sort({ 'display.order': 1, order: 1, 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Banner.countDocuments(filter),
    ]);

    return {
      items: items.map((item) => this._formatBanner(item)),
      pagination: getPaginationMeta(total, page, limit),
    };
  }

  // ------------------------------- get banner lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { isDeleted: false, status: 'active' };

    if (queryParams.type) {
      filter.$or = [
        { 'display.type': queryParams.type },
        { type: queryParams.type },
      ];
    }

    const items = await Banner.find(filter)
      .populate('display.category', 'name slug')
      .lean();

    return items.map((item) => this._formatBanner(item));
  }

  // ------------------------------- update banner ----------------------------
  async update(id, data) {
    const normalized = this._normalizePayload(data);
    const banner = await Banner.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: normalized },
      { new: true, runValidators: true }
    ).populate('display.category', 'name slug');

    if (!banner) {
      throw new ApiError(404, 'Banner not found');
    }

    return this._formatBanner(banner);
  }

  // ------------------------------- delete banner ----------------------------
  async delete(id) {
    const banner = await Banner.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, status: 'inactive' } },
      { new: true }
    );

    if (!banner) {
      throw new ApiError(404, 'Banner not found');
    }

    return { message: 'Banner deleted successfully', id };
  }
}

module.exports = new BannerService();
