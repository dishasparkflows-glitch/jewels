const mongoose = require('mongoose');
const Filter = require('./filter.model');
const Category = require('../category/category.model');
const DiamondType = require('../diamondType/diamondType.model');
const DiamondClarity = require('../diamondClarity/diamondClarity.model');
const Featured = require('../featured/featured.model');
const GemstoneType = require('../gemstoneType/gemstoneType.model');
const GemstoneShape = require('../gemstoneShape/gemstoneShape.model');
const Birthstone = require('../birthstone/birthstone.model');
const ApiError = require('../../utils/ApiError');

const DEFAULT_PRICE_RANGES = [
  { label: 'Below ₹10,000', min: null, max: 10000, order: 1 },
  { label: '₹10,001 - ₹25,000', min: 10001, max: 25000, order: 2 },
  { label: '₹25,001 - ₹50,000', min: 25001, max: 50000, order: 3 },
  { label: '₹50,001 - ₹1,00,000', min: 50001, max: 100000, order: 4 },
  { label: '₹1,00,001 - ₹2,00,000', min: 100001, max: 200000, order: 5 },
  { label: 'Above ₹2,00,001', min: 200001, max: null, order: 6 },
];

function isPriceRangeFilter(filterDoc) {
  return (
    filterDoc?.filterId === 'price-range' ||
    filterDoc?.key === 'price' ||
    filterDoc?.type === 'range'
  );
}

function formatPriceRangeLabel(min, max) {
  const hasMin = min !== null && min !== undefined && min !== '';
  const hasMax = max !== null && max !== undefined && max !== '';
  const fmt = (val) => `₹${Number(val).toLocaleString('en-IN')}`;

  if (!hasMin && hasMax) return `Below ${fmt(max)}`;
  if (hasMin && !hasMax) return `Above ${fmt(min)}`;
  if (hasMin && hasMax) return `${fmt(min)} - ${fmt(max)}`;
  return '';
}

function normalizePriceRanges(rawRanges = []) {
  if (!Array.isArray(rawRanges)) {
    throw new ApiError(400, 'priceRanges must be an array');
  }

  const normalized = [];
  for (let i = 0; i < rawRanges.length; i += 1) {
    const entry = rawRanges[i] || {};
    const min =
      entry.min === '' || entry.min === null || entry.min === undefined
        ? null
        : Number(entry.min);
    const max =
      entry.max === '' || entry.max === null || entry.max === undefined
        ? null
        : Number(entry.max);

    if (min !== null && (!Number.isFinite(min) || min < 0)) {
      throw new ApiError(400, `Price range #${i + 1}: min price must be a non-negative number`);
    }
    if (max !== null && (!Number.isFinite(max) || max < 0)) {
      throw new ApiError(400, `Price range #${i + 1}: max price must be a non-negative number`);
    }
    if (min === null && max === null) {
      throw new ApiError(400, `Price range #${i + 1}: enter at least a min or max price`);
    }
    if (min !== null && max !== null && min > max) {
      throw new ApiError(400, `Price range #${i + 1}: max price must be greater than or equal to min price`);
    }

    const label = String(entry.label || '').trim();
    normalized.push({
      ...(entry._id && mongoose.isValidObjectId(entry._id) ? { _id: entry._id } : {}),
      label,
      min,
      max,
      order: entry.order !== undefined ? Number(entry.order) : i + 1,
    });
  }

  return normalized.map((item, idx) => ({ ...item, order: idx + 1 }));
}

function mapPriceRangesToOptions(priceRanges = []) {
  return [...(Array.isArray(priceRanges) ? priceRanges : [])]
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((item, idx) => {
      const min = item.min === undefined || item.min === '' ? null : item.min;
      const max = item.max === undefined || item.max === '' ? null : item.max;
      const value = `${min ?? ''}-${max ?? ''}`;
      const displayLabel = item.label ? String(item.label).trim() : formatPriceRangeLabel(min, max);
      return {
        _id: String(item._id || value || idx),
        name: displayLabel,
        label: item.label ? String(item.label).trim() : '',
        value,
        min,
        max,
        order: item.order ?? idx + 1,
      };
    });
}

async function loadAllFilterOptions() {
  const activeFilter = { 'meta.deletedAt': null, status: 'active' };

  const [diamondTypes, diamondClarities, collections, categories, gemstoneTypes, gemstoneShapes, birthstones] = await Promise.all([
    DiamondType.find(activeFilter).sort({ name: 1 }).select('_id name').lean(),
    DiamondClarity.find(activeFilter).sort({ name: 1 }).select('_id name').lean(),
    Featured.find(activeFilter).sort({ order: 1, name: 1 }).select('_id name').lean(),
    Category.find(activeFilter).sort({ order: 1, name: 1 }).select('_id name slug').lean(),
    GemstoneType.find(activeFilter).sort({ order: 1, name: 1 }).select('_id name slug colorCode colorCodeEnd swatchImage image').lean(),
    GemstoneShape.find(activeFilter).sort({ order: 1, name: 1 }).select('_id name code iconSvg image').lean(),
    Birthstone.find(activeFilter).sort({ order: 1 }).select('_id month stoneName image order').lean(),
  ]);

  const caratWeights = [];

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

  const formattedGemstoneTypes = gemstoneTypes.map((item) => ({
    _id: String(item._id),
    name: item.name,
    value: item.slug || item.name,
    colorCode: item.colorCode || '#9966CC',
    colorCodeEnd: item.colorCodeEnd || item.colorCode || '#9966CC',
    swatchImage: item.swatchImage?.url || null,
  }));

  const formattedGemstoneShapes = gemstoneShapes.map((item) => ({
    _id: String(item._id),
    name: item.name,
    value: item.code || item.name.toLowerCase(),
    code: item.code,
    iconSvg: item.iconSvg || null,
  }));

  const formattedBirthstones = (birthstones || []).map((item) => ({
    _id: String(item._id),
    name: item.month,
    value: item.month,
    month: item.month,
    stoneName: item.stoneName || '',
    imageUrl: item.image?.url || '',
    order: item.order || 0,
  }));

  return {
    'jewellery-types': formattedCategories,
    'price-range': [],
    'carat-weights': formattedCaratWeights,
    'diamond-types': formattedDiamondTypes,
    'diamond-clarities': formattedDiamondClarities,
    'gemstone-types': formattedGemstoneTypes,
    'gemstone-shapes': formattedGemstoneShapes,
    collections: formattedCollections,
    gender: genders,
    metal: metals,
    birthstones: formattedBirthstones,
    birthMonth: formattedBirthstones,
    'birthstone-months': formattedBirthstones,
    _raw: {
      diamondTypes: formattedDiamondTypes,
      diamondClarities: formattedDiamondClarities,
      caratWeights: formattedCaratWeights,
      gemstoneTypes: formattedGemstoneTypes,
      gemstoneShapes: formattedGemstoneShapes,
      collections: formattedCollections,
      categories: formattedCategories,
      birthstones: formattedBirthstones,
      genders,
      metals,
    },
  };
}

class FilterService {
  // ------------------------------- ensure default filters exist ----------------------------
  async ensureDefaultFilters() {
    try {
      const existing = await Filter.findOne({
        $or: [{ filterId: 'birthstones' }, { key: 'birthMonth' }],
      });
      if (!existing) {
        const categories = await Category.find({ 'meta.deletedAt': null }).select('_id slug').lean();
        const categoryConfigs = categories.map((cat, idx) => ({
          categoryId: cat._id,
          categorySlug: cat.slug || '',
          enabled: true,
          order: 11,
          customTitle: '',
        }));

        await Filter.create({
          filterId: 'birthstones',
          title: 'Birthstone',
          key: 'birthMonth',
          type: 'checkbox',
          order: 11,
          status: 'active',
          categoryConfigs,
        });
      }

      // Initialize default price ranges on price-range filter if not yet configured
      await Filter.updateOne(
        {
          $or: [{ filterId: 'price-range' }, { key: 'price' }],
          priceRanges: { $exists: false },
        },
        { $set: { priceRanges: DEFAULT_PRICE_RANGES } }
      );
    } catch (err) {
      console.warn('Failed to ensure default filters:', err);
    }
  }

  // ------------------------------- get filters ----------------------------
  async getFilters(queryParams = {}) {
    await this.ensureDefaultFilters();

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

        const isMasterActive = f.status === 'active' || (f.status !== 'inactive' && f.enabled !== false);
        let isEnabled = isMasterActive;
        const masterOrder = f.order !== undefined ? f.order : 0;
        let customTitle = f.title;

        if (config) {
          isEnabled = isMasterActive && config.enabled !== false;
          if (config.customTitle) {
            // Guard: range/price filter titles should never be overridden by an unrelated name like a category name
            if ((f.filterId === 'price-range' || f.key === 'price' || f.type === 'range') && !/price|budget|range|cost/i.test(config.customTitle)) {
              customTitle = f.title || 'Price Range';
            } else {
              customTitle = config.customTitle;
            }
          }
        }

        // Always keep Jewellery Types / category filter enabled across all categories so users can switch types
        if (f.filterId === 'jewellery-types' || f.key === 'category') {
          isEnabled = isMasterActive;
        }

        const priceRangeOpts = isPriceRangeFilter(f)
          ? mapPriceRangesToOptions(f.priceRanges || [])
          : null;

        return {
          id: f.filterId,
          filterId: f.filterId,
          title: customTitle || f.title,
          customTitle: config?.customTitle || '',
          key: f.key,
          type: f.type,
          order: masterOrder,
          status: isMasterActive ? 'active' : 'inactive',
          enabled: isEnabled,
          ...(isPriceRangeFilter(f) ? { priceRanges: f.priceRanges || [] } : {}),
          options: priceRangeOpts || loadedOptions[f.filterId] || loadedOptions[f.key] || [],
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
      .map((f) => {
        const isMasterActive = f.status === 'active' || (f.status !== 'inactive' && f.enabled !== false);
        const priceRangeOpts = isPriceRangeFilter(f)
          ? mapPriceRangesToOptions(f.priceRanges || [])
          : null;
        return {
          id: f.filterId,
          filterId: f.filterId,
          title: f.title,
          customTitle: '',
          key: f.key,
          type: f.type,
          order: f.order,
          status: isMasterActive ? 'active' : 'inactive',
          enabled: isMasterActive,
          ...(isPriceRangeFilter(f) ? { priceRanges: f.priceRanges || [] } : {}),
          options: priceRangeOpts || loadedOptions[f.filterId] || loadedOptions[f.key] || [],
        };
      })
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
        if (f.status === 'inactive' || f.enabled === false) return false;
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
        ...(isPriceRangeFilter(f) ? { priceRanges: f.priceRanges || [] } : {}),
        options: (f.options || []).map((opt) => ({
          _id: String(opt._id),
          name: opt.name || opt.title || opt.value,
          value: opt.value || opt.name || opt.slug,
          ...(opt.label ? { label: opt.label } : {}),
          ...(opt.min !== undefined ? { min: opt.min } : {}),
          ...(opt.max !== undefined ? { max: opt.max } : {}),
          ...(opt.slug ? { slug: opt.slug } : {}),
          ...(opt.weight !== undefined ? { weight: opt.weight } : {}),
          ...(opt.imageUrl ? { imageUrl: opt.imageUrl } : {}),
          ...(opt.stoneName ? { stoneName: opt.stoneName } : {}),
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
  // ------------------------------- get all filters with categories ----------------------------
  async getAllFiltersWithCategories() {
    await this.ensureDefaultFilters();
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

      const isMasterActive = f.status === 'active' || (f.status !== 'inactive' && f.enabled !== false);
      return {
        _id: f._id,
        filterId: f.filterId,
        title: f.title,
        key: f.key,
        type: f.type,
        order: f.order,
        status: isMasterActive ? 'active' : 'inactive',
        enabled: isMasterActive,
        ...(isPriceRangeFilter(f) ? { priceRanges: f.priceRanges || [] } : {}),
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
    const updateData = { ...data };
    if (updateData.status) {
      updateData.status = updateData.status === 'active' ? 'active' : 'inactive';
    }
    if (updateData.priceRanges !== undefined) {
      updateData.priceRanges = normalizePriceRanges(updateData.priceRanges);
    }
    const filter = await Filter.findOneAndUpdate(
      {
        $or: [
          { filterId },
          ...(mongoose.isValidObjectId(filterId) ? [{ _id: filterId }] : []),
        ],
        'meta.deletedAt': null,
      },
      { $set: updateData },
      { new: true }
    );
    if (!filter) {
      throw new ApiError(404, 'Filter not found');
    }
    return filter;
  }
}

module.exports = new FilterService();

