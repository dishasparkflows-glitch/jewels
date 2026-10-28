const Category = require('./category.model');
const MenuSection = require('../menuSection/menuSection.model');
const MenuItem = require('../menuItem/menuItem.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

const id = (value) => String(value?._id || value);
const active = (row) => row.status === 'active' && !row.meta?.deletedAt;
const ordered = (rows) => [...rows].sort((a, b) => (a.order || 0) - (b.order || 0));

function buildNavigation(categories, sections, items) {
  return ordered(categories.filter(active)).map((category) => ({
    _id: category._id,
    name: category.name,
    slug: category.slug,
    promoBanners: ordered(category.promoBanners || []).map((banner) => ({
      _id: banner._id,
      title: banner.title || '',
      image: { url: banner.image?.url || '' },
    })),
    menuSections: ordered(
      sections.filter((section) => active(section) && id(section.categoryId) === id(category))
    ).map((section) => ({
      _id: section._id,
      name: section.title,
      menuItems: ordered(
        items.filter((item) => active(item) && id(item.menuSectionId) === id(section))
      ).map((item) => ({
        _id: item._id,
        name: item.title,
        icon: { url: item.icon?.url || '' },
      })),
    })),
  }));
}

function normalizeSizeChart(data) {
  if (!data || data.sizeChart === undefined) return;
  if (typeof data.sizeChart === 'string') {
    const url = data.sizeChart.trim();
    let key = data.sizeChartKey || '';
    if (!key && url) {
      const match = url.match(/categories\/[^\s?#]+/);
      if (match) key = match[0];
    }
    data.sizeChart = { url, key };
  } else if (data.sizeChart && typeof data.sizeChart === 'object') {
    const url = (data.sizeChart.url || '').trim();
    let key = (data.sizeChart.key || data.sizeChartKey || '').trim();
    if (!key && url) {
      const match = url.match(/categories\/[^\s?#]+/);
      if (match) key = match[0];
    }
    data.sizeChart = { url, key };
  }
  delete data.sizeChartKey;
}

class CategoryService {
  // ------------------------------- create category ----------------------------
  async create(data) {
    normalizeSizeChart(data);
    return await Category.create(data);
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
    normalizeSizeChart(data);
    const item = await Category.findOneAndUpdate(
      { _id: id },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
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
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'Category not found');
    }

    return { message: 'Category deleted successfully', id };
  }

  // ------------------------------- get storefront navigation ----------------------------
  async getNavigation() {
    const categories = await Category.find({ status: 'active', 'meta.deletedAt': null })
      .select('_id name slug promoBanners status meta.deletedAt')
      .sort({ order: 1, _id: 1 })
      .lean();

    const sections = await MenuSection.find({
      categoryId: { $in: categories.map((category) => category._id) },
      status: 'active',
      'meta.deletedAt': null,
    })
      .select('_id categoryId title order status')
      .sort({ order: 1, _id: 1 })
      .lean();

    const items = await MenuItem.find({
      menuSectionId: { $in: sections.map((section) => section._id) },
      status: 'active',
      'meta.deletedAt': null,
    })
      .select('_id menuSectionId title icon.url order status')
      .sort({ order: 1, _id: 1 })
      .lean();

    return buildNavigation(categories, sections, items);
  }

  buildNavigation(categories, sections, items) {
    return buildNavigation(categories, sections, items);
  }
}

module.exports = new CategoryService();
module.exports.buildNavigation = buildNavigation;
