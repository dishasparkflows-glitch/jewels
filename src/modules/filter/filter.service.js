const mongoose = require('mongoose');
const Filter = require('./filter.model');
const Category = require('../category/category.model');
const DiamondType = require('../diamondType/diamondType.model');
const DiamondClarity = require('../diamondClarity/diamondClarity.model');
const CaratWeight = require('../caratWeight/caratWeight.model');
const Featured = require('../featured/featured.model');
const ApiError = require('../../utils/ApiError');

async function loadAllFilterOptions() {
  const activeFilter = { 'meta.deletedAt': null, status: 'active' };

  const [diamondTypes, diamondClarities, caratWeights, collections, categories] = await Promise.all([
    DiamondType.find(activeFilter).sort({ name: 1 }).select('_id name').lean(),
    DiamondClarity.find(activeFilter).sort({ name: 1 }).select('_id name').lean(),
    CaratWeight.find(activeFilter).sort({ order: 1, weight: 1, name: 1 }).select('_id name weight').lean(),
    Featured.find(activeFilter).sort({ order: 1, name: 1 }).select('_id name').lean(),
    Category.find(activeFilter).sort({ order: 1, name: 1 }).select('_id name slug').lean(),
  ]);

  const formattedDiamondTypes = diamondTypes.map((item) => ({
    _id: String(item._id),
    name: item.name,
    value: item.name,
  }));

  const formattedDiamondClarities = diamondClarities.map((item) => ({
    _id: String(item._id),
    name: item.name,
    value: item.name,
  }));

  const formattedCaratWeights = caratWeights.map((item) => ({
    _id: String(item._id),
    name: item.name || (item.weight ? `${item.weight} Ct` : ''),
    value: item.weight ? `${item.weight} Ct` : (item.name || ''),
    weight: item.weight,
  }));

  const formattedCollections = collections.map((item) => ({
    _id: String(item._id),
    name: item.name,
    title: item.name,
    value: item.name,
  }));

  const formattedCategories = categories.map((item) => ({
    _id: String(item._id),
    name: item.name,
    value: item.slug || item.name,
    slug: item.slug,
  }));

  const genders = [
    { _id: 'Women', name: 'Women', value: 'women' },
    { _id: 'Men', name: 'Men', value: 'men' },
    { _id: 'Kids', name: 'Kids', value: 'kids' },
    { _id: 'Unisex', name: 'Unisex', value: 'unisex' },
  ];

  const metals = [
    { _id: 'Yellow Gold', name: 'Yellow Gold', value: 'Yellow Gold' },
    { _id: 'White Gold', name: 'White Gold', value: 'White Gold' },
    { _id: 'Rose Gold', name: 'Rose Gold', value: 'Rose Gold' },
    { _id: 'Silver', name: 'Silver', value: 'Silver' },
    { _id: 'Platinum', name: 'Platinum', value: 'Platinum' },
  ];

  return {
    'jewellery-types': formattedCategories,
    'price-range': [],
    'carat-weights': formattedCaratWeights,
    'diamond-types': formattedDiamondTypes,
    'diamond-clarities': formattedDiamondClarities,
    collections: formattedCollections,
    gender: genders,
    metal: metals,
    _raw: {
      diamondTypes: formattedDiamondTypes,
      diamondClarities: formattedDiamondClarities,
      caratWeights: formattedCaratWeights,
      collections: formattedCollections,
      categories: formattedCategories,
      genders,
      metals,
    },
  };
}

class FilterService {
  // ------------------------------- get filters ----------------------------
  async getFilters(queryParams = {}) {

    const categoryParam = queryParams.categoryId || queryParams.category || queryParams.categorySlug;
    let targetCategory = null;

    if (categoryParam) {
      if (mongoose.isValidObjectId(categoryParam)) {
        targetCategory = await Category.findOne({
          _id: categoryParam,
          'meta.deletedAt': null,
        }).select('_id name slug').lean();
      }

      if (!targetCategory) {
        targetCategory = await Category.findOne({
          $or: [
            { slug: String(categoryParam).toLowerCase() },
            { name: new RegExp(`^${categoryParam}$`, 'i') },
          ],
          'meta.deletedAt': null,
        }).select('_id name slug').lean();
      }
    }

    const allFilters = await Filter.find({ 'meta.deletedAt': null }).lean();
    const loadedOptions = await loadAllFilterOptions();

    // 1. If Category is specified: resolve category-wise enabled, order, custom title & default value
    if (targetCategory) {
      const catIdStr = String(targetCategory._id);
      const catSlug = (targetCategory.slug || '').toLowerCase();

      const configured = allFilters.map((f) => {
        // Find configuration for this category
        const config = (f.categoryConfigs || []).find(
          (c) => String(c.categoryId) === catIdStr || (c.categorySlug && c.categorySlug.toLowerCase() === catSlug)
        );

        let isEnabled = f.enabled !== false;
        let order = f.order || 0;
        let customTitle = f.title;

        if (config) {
          isEnabled = config.enabled !== false;
          if (config.order !== undefined) order = config.order;
          if (config.customTitle) customTitle = config.customTitle;
        }

        return {
          id: f.filterId,
          filterId: f.filterId,
          title: customTitle || f.title,
          customTitle: config?.customTitle || '',
          key: f.key,
          type: f.type,
          order,
          enabled: isEnabled,
          options: loadedOptions[f.filterId] || [],
        };
      }).sort((a, b) => a.order - b.order);

      return {
        categoryId: targetCategory._id,
        categoryName: targetCategory.name,
        categorySlug: targetCategory.slug,
        filters: configured,
      };
    }

    // 2. Global / Unfiltered response: return all master filters
    const globalFilters = allFilters
      .map((f) => ({
        id: f.filterId,
        filterId: f.filterId,
        title: f.title,
        customTitle: '',
        key: f.key,
        type: f.type,
        order: f.order,
        enabled: f.enabled !== false,
        options: loadedOptions[f.filterId] || [],
      }))
      .sort((a, b) => a.order - b.order);

    return {
      categoryId: null,
      categoryName: 'All Categories',
      categorySlug: 'all',
      filters: globalFilters,
    };
  }
  // ------------------------------- get storefront filters ----------------------------
  async getStorefrontFilters(queryParams = {}) {
    const result = await this.getFilters(queryParams);

    // Keep only enabled filters that have valid options (or range filters)
    const cleanFilters = (result.filters || [])
      .filter((f) => {
        if (f.enabled === false) return false;
        if (f.type === 'checkbox' && (!f.options || f.options.length === 0)) return false;
        return true;
      })
      .map((f) => ({
        id: f.id || f.filterId,
        filterId: f.filterId || f.id,
        title: f.title,
        key: f.key,
        type: f.type,
        order: f.order,
        enabled: true,
        options: (f.options || []).map((opt) => ({
          _id: String(opt._id),
          name: opt.name || opt.title || opt.value,
          value: opt.value || opt.name || opt.slug,
          ...(opt.slug ? { slug: opt.slug } : {}),
          ...(opt.weight !== undefined ? { weight: opt.weight } : {}),
        })),
      }))
      .sort((a, b) => a.order - b.order);

    return {
      categoryId: result.categoryId,
      categoryName: result.categoryName,
      categorySlug: result.categorySlug,
      filters: cleanFilters,
    };
  }
  // ------------------------------- update category filters ----------------------------
  async updateCategoryFilters(categoryId, filterList) {
    const category = await Category.findOne({ _id: categoryId, 'meta.deletedAt': null }).lean();
    if (!category) {
      throw new ApiError(404, 'Category not found');
    }

    const items = Array.isArray(filterList) ? filterList : (filterList?.filters || []);
    const catIdStr = String(category._id);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const filterDoc = await Filter.findOne({
        $or: [{ filterId: item.filterId || item.id }, { _id: item._id }],
        'meta.deletedAt': null,
      });

      if (!filterDoc) continue;

      const existingIndex = (filterDoc.categoryConfigs || []).findIndex(
        (c) => String(c.categoryId) === catIdStr
      );

      const updatedConfig = {
        categoryId: category._id,
        categorySlug: category.slug || '',
        enabled: item.enabled !== false,
        order: item.order !== undefined ? Number(item.order) : i + 1,
        customTitle: item.customTitle ? String(item.customTitle).trim() : '',
      };

      if (existingIndex >= 0) {
        filterDoc.categoryConfigs[existingIndex] = updatedConfig;
      } else {
        filterDoc.categoryConfigs.push(updatedConfig);
      }

      await filterDoc.save();
    }

    return this.getFilters({ categoryId: category._id });
  }
  // ------------------------------- get all filters with categories ----------------------------
  async getAllFiltersWithCategories() {
    const allFilters = await Filter.find({ 'meta.deletedAt': null }).sort({ order: 1 }).lean();
    const allCategories = await Category.find({ 'meta.deletedAt': null })
      .select('_id name slug icon images order')
      .sort({ order: 1 })
      .lean();

    return allFilters.map((f) => {
      const configMap = new Map((f.categoryConfigs || []).map((c) => [String(c.categoryId), c]));

      const categoriesWithConfig = allCategories.map((cat, idx) => {
        const cfg = configMap.get(String(cat._id));
        return {
          categoryId: cat._id,
          categoryName: cat.name,
          categorySlug: cat.slug,
          icon: cat.icon,
          images: cat.images,
          enabled: cfg ? cfg.enabled !== false : true,
          order: cfg?.order !== undefined ? cfg.order : idx + 1,
          customTitle: cfg?.customTitle || '',
        };
      }).sort((a, b) => a.order - b.order);

      return {
        _id: f._id,
        filterId: f.filterId,
        title: f.title,
        key: f.key,
        type: f.type,
        order: f.order,
        enabled: f.enabled !== false,
        categories: categoriesWithConfig,
      };
    });
  }
  // ------------------------------- update filter categories ----------------------------
  async updateFilterCategories(filterId, categoryAssignments) {
    const filter = await Filter.findOne({
      $or: [
        { filterId },
        ...(mongoose.isValidObjectId(filterId) ? [{ _id: filterId }] : []),
      ],
      'meta.deletedAt': null,
    });
    if (!filter) {
      throw new ApiError(404, 'Filter not found');
    }

    const allCategories = await Category.find({ 'meta.deletedAt': null }).select('_id slug name').lean();
    const catMap = new Map(allCategories.map((c) => [String(c._id), c]));

    const list = Array.isArray(categoryAssignments) ? categoryAssignments : (categoryAssignments.categories || []);

    const updatedConfigs = list.map((item, idx) => {
      const cat = catMap.get(String(item.categoryId));
      return {
        categoryId: item.categoryId,
        categorySlug: cat ? cat.slug : (item.categorySlug || ''),
        enabled: item.enabled !== false,
        order: item.order !== undefined ? Number(item.order) : idx + 1,
        customTitle: item.customTitle ? String(item.customTitle).trim() : '',
      };
    });

    filter.categoryConfigs = updatedConfigs;
    await filter.save();
    return filter;
  }
  // ------------------------------- reorder filters ----------------------------
  async reorderFilters(orderedFilterIds) {
    const list = Array.isArray(orderedFilterIds) ? orderedFilterIds : (orderedFilterIds?.filterIds || []);
    if (!list || list.length === 0) return this.getAllFiltersWithCategories();

    const bulkOps = list.map((id, index) => {
      const filterQuery = mongoose.isValidObjectId(id)
        ? { $or: [{ _id: id }, { filterId: id }] }
        : { filterId: id };

      return {
        updateOne: {
          filter: { ...filterQuery, 'meta.deletedAt': null },
          update: { $set: { order: index + 1 } },
        },
      };
    });

    if (bulkOps.length > 0) {
      await Filter.bulkWrite(bulkOps);
    }
    return this.getAllFiltersWithCategories();
  }
  // ------------------------------- update filter ----------------------------
  async updateFilter(filterId, data) {
    const filter = await Filter.findOneAndUpdate(
      { filterId, 'meta.deletedAt': null },
      { $set: data },
      { new: true }
    );
    if (!filter) {
      throw new ApiError(404, 'Filter not found');
    }
    return filter;
  }
}

module.exports = new FilterService();

