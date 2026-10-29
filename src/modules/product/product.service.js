const mongoose = require('mongoose');
const Product = require('./product.model');
const Setting = require('../setting/setting.model');
const {
  calculateProductPricing,
  loadPricingMasters
} = require('./product.pricing');
const DiamondType = require('../diamondType/diamondType.model');
const DiamondClarity = require('../diamondClarity/diamondClarity.model');
const CaratWeight = require('../caratWeight/caratWeight.model');
const Featured = require('../featured/featured.model');
const Wishlist = require('../wishlist/wishlist.model');
const ProductGroup = require('../productGroup/productGroup.model');
const productGroupService = require('../productGroup/productGroup.service');
const { SHOP_FOR_OPTIONS, getShopForGenders } = require('./product.filters');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const {
  withColorStatuses,
  sanitizeColorImages,
  isPricingUnchanged,
  formatHomeProduct,
  formatStorefrontProduct,
  formatLookupProduct,
  buildProductSearchFilter,
  buildProductTypeFilter,
  buildLookupProductTypeFilter,
  getEffectivePriceExpression,
  buildPriceRangeConditions
} = require('./product.utils');

class ProductService {
  async previewPricing(data) {
    return calculateProductPricing(data, await loadPricingMasters());
  }

  async applyPricing(data) {
    if (data.productType === 'silver' || Boolean(data.isOrnate)) return data;
    // For drafts, never fail product creation if specifications or purities are not yet configured
    if (data.status === 'draft') {
      const metalWeight = Number(data.specifications?.metalWeight);
      if (!metalWeight || metalWeight <= 0) return data;
      try {
        const result = await this.previewPricing(data);
        return {
          ...data,
          variants: result.variants,
          pricing: { ...data.pricing, salePrice: result.salePrice }
        };
      } catch (err) {
        return data;
      }
    }
    const result = await this.previewPricing(data);
    return {
      ...data,
      variants: result.variants,
      pricing: { ...data.pricing, salePrice: result.salePrice }
    };
  }

  // Refresh calculated prices before DB filtering/sorting so listing prices and
  // detail prices use the same current master rates. Manual/ERP rows are untouched.
  async refreshCalculatedPrices() {
    if (this.pricingRefresh) return this.pricingRefresh;
    this.pricingRefresh = (async () => {
      const products = await Product.find({
        productType: { $ne: 'silver' },
        isOrnate: { $ne: true },
        'meta.deletedAt': null
      }).lean();
      if (!products.length) return;
      const masters = await loadPricingMasters();
      const writes = [];
      for (const product of products) {
        try {
          const result = calculateProductPricing(product, masters);
          const unchanged = isPricingUnchanged(product, result);
          if (!unchanged) {
            writes.push({
              updateOne: {
                filter: {
                  _id: product._id,
                  'meta.updatedAt': product.meta?.updatedAt
                },
                update: {
                  $set: {
                    variants: result.variants,
                    'pricing.salePrice': result.salePrice
                  }
                }
              }
            });
          }
        } catch (err) {
          // Skip products that cannot be automatically calculated
          continue;
        }
      }
      if (writes.length) await Product.bulkWrite(writes);
    })();
    try {
      await this.pricingRefresh;
    } finally {
      this.pricingRefresh = null;
    }
  }

  // ------------------------------- create product ----------------------------
  async create(data) {
    if (data.status && data.status !== 'approved' && data.status !== 'draft') {
      data.status = 'draft';
    }
    if (data.colorImages) {
      data.colorImages = sanitizeColorImages(data.colorImages);
    }
    if (data.basicInfo?.sku) {
      const existingSku = await Product.findOne({
        'basicInfo.sku': data.basicInfo.sku
      });
      if (existingSku) {
        throw new ApiError(
          409,
          `Product with SKU/Tag "${data.basicInfo.sku}" already exists`
        );
      }
    }

    const created = await Product.create(await this.applyPricing(data));
    try {
      await productGroupService.refreshAffectedGroups(created._id);
    } catch (err) {
      console.error('Error refreshing groups after product creation:', err);
    }
    return created;
  }

  async _getWishlistSet(userId) {
    if (!userId) return new Set();
    try {
      const wishlist = await Wishlist.findOne({ userId }).select('productIds').lean();
      if (!wishlist?.productIds || !Array.isArray(wishlist.productIds)) return new Set();
      return new Set(wishlist.productIds.map((id) => String(id)));
    } catch {
      return new Set();
    }
  }

  // ------------------------------- get one product ----------------------------
  async getOne(id, userId = null) {
    await this.refreshCalculatedPrices();
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const filter = isObjectId
      ? { $or: [{ _id: id }, { 'basicInfo.slug': id }] }
      : { 'basicInfo.slug': id };

    const populateOptions = this._getProductPopulateOptions();

    let productQuery = Product.findOne(filter);
    for (const pop of populateOptions) {
      productQuery = productQuery.populate(pop);
    }
    let product = await productQuery.lean();

    // Fallback 1: If not found and id ends with group sequence (e.g. -000030), try stripping the sequence
    if (!product && typeof id === 'string' && /-\d{6}$/.test(id)) {
      const strippedSlug = id.replace(/-\d{6}$/, '');
      let fallbackQuery = Product.findOne({ 'basicInfo.slug': strippedSlug });
      for (const pop of populateOptions) {
        fallbackQuery = fallbackQuery.populate(pop);
      }
      product = await fallbackQuery.lean();
    }

    // Fallback 2: Check ProductGroup by slug, groupCode, or _id
    if (!product) {
      const groupFilter = isObjectId
        ? { $or: [{ _id: id }, { slug: id }, { groupCode: id }], 'meta.deletedAt': null }
        : { $or: [{ slug: id }, { groupCode: id }], 'meta.deletedAt': null };
      const group = await ProductGroup.findOne(groupFilter).lean();
      if (group) {
        const targetProdId = group.primaryProductId || (Array.isArray(group.productIds) ? group.productIds[0] : null);
        if (targetProdId) {
          let groupProductQuery = Product.findOne({ _id: targetProdId });
          for (const pop of populateOptions) {
            groupProductQuery = groupProductQuery.populate(pop);
          }
          product = await groupProductQuery.lean();
        }
      }
    }

    if (!product) {
      throw new ApiError(404, 'Product not found');
    }

    const setting = await Setting.findOne().select('certificateImage').lean();
    const certificateImage = product.certificateImage?.url
      ? product.certificateImage
      : setting?.certificateImage || null;

    const wishlistedSet = await this._getWishlistSet(userId);
    const inWishlist = wishlistedSet.has(String(product._id));
    const sizeChart = await this._extractSizeChart(product);

    return withColorStatuses({ ...product, certificateImage, inWishlist, sizeChart });
  }

  // ------------------------------- get product by sku or tag ----------------------------
  async getBySkuOrTag(code, userId = null) {
    await this.refreshCalculatedPrices();
    const populateOptions = this._getProductPopulateOptions();
    let productQuery = Product.findOne({
      $or: [{ 'basicInfo.sku': code }, { 'ornate.tagNo': code }]
    });
    for (const pop of populateOptions) {
      productQuery = productQuery.populate(pop);
    }
    const product = await productQuery.lean();
    if (!product) {
      throw new ApiError(404, `Product with SKU/Tag "${code}" not found`);
    }

    const setting = await Setting.findOne().select('certificateImage').lean();
    const certificateImage = product.certificateImage?.url
      ? product.certificateImage
      : setting?.certificateImage || null;

    const wishlistedSet = await this._getWishlistSet(userId);
    const inWishlist = wishlistedSet.has(String(product._id));
    const sizeChart = await this._extractSizeChart(product);

    return withColorStatuses({ ...product, certificateImage, inWishlist, sizeChart });
  }

  // Shared populate options for full product detail views
  _getProductPopulateOptions() {
    return [
      { path: 'categoryIds', select: 'name slug sizeChart', strictPopulate: false },
      { path: 'metalColorIds', select: 'name code colorCode colorCodeEnd', strictPopulate: false },
      { path: 'metalPurityIds', select: 'name karat metalType', strictPopulate: false },
      { path: 'colorImages.metalColorId', select: 'name code colorCode colorCodeEnd', strictPopulate: false },
      { path: 'variants.metalColorId', select: 'name code colorCode colorCodeEnd', strictPopulate: false },
      { path: 'variants.metalPurityId', select: 'name karat metalType', strictPopulate: false },
      { path: 'variants.diamondTypeId', select: 'name', strictPopulate: false },
      { path: 'variants.diamondShapeId', select: 'name', strictPopulate: false },
      { path: 'variants.diamondColorId', select: 'name', strictPopulate: false },
      { path: 'variants.diamondClarityId', select: 'name', strictPopulate: false },
    ];
  }

  // Extract size chart from populated categoryIds or category model
  async _extractSizeChart(product) {
    if (!product) return null;
    const Category = require('../category/category.model');
    const categories = Array.isArray(product.categoryIds)
      ? product.categoryIds
      : product.category
      ? [product.category]
      : [];

    for (const cat of categories) {
      if (cat && typeof cat === 'object') {
        const sc = cat.sizeChart;
        const scUrl = typeof sc === 'object' ? sc?.url : sc;
        if (scUrl) {
          return this._formatSizeChart(sc, cat.name);
        }
      }
    }

    // Fallback: check raw unpopulated category ObjectIds
    const rawIds = categories
      .map((c) => (c && typeof c === 'object' ? c._id : c))
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    if (rawIds.length > 0) {
      const foundCat = await Category.findOne({
        _id: { $in: rawIds },
        $or: [
          { 'sizeChart.url': { $exists: true, $nin: ['', null] } },
          { sizeChart: { $type: 'string', $nin: ['', null] } },
        ],
      }).select('name sizeChart').lean();

      if (foundCat?.sizeChart) {
        return this._formatSizeChart(foundCat.sizeChart, foundCat.name);
      }
    }

    return null;
  }

  _formatSizeChart(chart, categoryName = '') {
    if (!chart) return null;
    const rawUrl = typeof chart === 'object' ? chart.url : chart;
    const rawKey = typeof chart === 'object' ? chart.key : '';
    if (!rawUrl) return null;
    const trimmed = String(rawUrl).trim();
    if (!trimmed) return null;
    const resolvedUrl =
      trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')
        ? trimmed
        : `/${trimmed}`;
    const isPdf = /\.pdf($|\?)/i.test(resolvedUrl);

    let key = rawKey;
    if (!key && resolvedUrl) {
      const match = resolvedUrl.match(/categories\/[^\s?#]+/);
      if (match) key = match[0];
    }

    return {
      url: resolvedUrl,
      key: key || '',
      categoryName: categoryName || 'Jewelry',
      isPdf,
    };
  }

  // ------------------------------- get all products ----------------------------
  async getAll(queryParams = {}, userId = null) {
    await this.refreshCalculatedPrices();
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    if (queryParams.search) {
      const searchConditions = buildProductSearchFilter(queryParams.search);
      if (searchConditions) filter.$or = searchConditions;
    }

    const isOrnateSpecified =
      queryParams.isOrnate !== undefined && queryParams.isOrnate !== '';
    if (queryParams.productType) {
      const typeCondition = buildProductTypeFilter(
        queryParams.productType,
        isOrnateSpecified
      );
      if (typeCondition) {
        filter.$and = [...(filter.$and || []), typeCondition];
      }
    }

    if (isOrnateSpecified) {
      const isO =
        queryParams.isOrnate === 'true' || queryParams.isOrnate === true;
      filter.$and = [
        ...(filter.$and || []),
        { isOrnate: isO ? true : { $ne: true } }
      ];
    }

    const resolvedStatus = queryParams.status === 'active' ? 'approved' : queryParams.status;
    if (queryParams.view === 'storefront') {
      filter.status = 'approved';
    } else if (resolvedStatus && resolvedStatus !== 'all') {
      filter.status = resolvedStatus;
    } else if (!resolvedStatus) {
      if (!isOrnateSpecified) {
        filter.status = 'approved';
      }
    }

    if (queryParams.category) {
      filter.categoryIds = queryParams.category;
    }

    if (queryParams.menuItem) {
      if (!mongoose.isValidObjectId(queryParams.menuItem))
        throw new ApiError(400, 'Valid menuItem ID is required');
      filter.$and = [
        ...(filter.$and || []),
        { $or: [{ menuItemIds: queryParams.menuItem }] }
      ];
    }

    // Grouping support using existing product_groups collection (zero $lookup, zero cache collection)
    let groupMetaByRepId = new Map();
    const shouldIncludeGroups = queryParams.includeGroups === 'true' || queryParams.includeGroups === true || queryParams.view === 'storefront';
    if (shouldIncludeGroups) {
      try {
        // 1. Find all active groups (filter by category if requested)
        const groupFilter = {
          status: 'active',
          'meta.deletedAt': null,
        };

        if (queryParams.category) {
          const catProductIds = await Product.find({
            categoryIds: queryParams.category,
            'meta.deletedAt': null,
          }).distinct('_id');

          groupFilter.$or = [
            { categoryId: queryParams.category },
            { productIds: { $in: catProductIds } },
          ];
        }

        const activeGroups = await ProductGroup.find(groupFilter)
          .select('_id groupCode groupName slug description productIds primaryProductId representativeMode categoryId')
          .lean();

        // 2. Resolve representative product IDs for active groups
        const repProductIds = [];
        for (const group of activeGroups) {
          let repId = group.primaryProductId;
          if (!repId && group.productIds?.length) {
            repId = await productGroupService.recalculateGroupRepresentative(group._id);
          }
          if (repId) {
            repProductIds.push(repId);
            groupMetaByRepId.set(String(repId), group);
          }
        }

        // 3. Union of all member product IDs across all active groups
        const allGroupedMemberIds = await ProductGroup.distinct('productIds', {
          status: 'active',
          'meta.deletedAt': null,
        });

        // 4. Construct listing condition: representatives of active groups + eligible standalone products
        const standaloneFilter = {
          _id: { $nin: allGroupedMemberIds },
        };
        if (queryParams.category) {
          standaloneFilter.categoryIds = queryParams.category;
        }

        filter.$or = [
          { _id: { $in: repProductIds } },
          standaloneFilter,
        ];

        // Clear top-level categoryIds as it is handled by the $or branches
        if (queryParams.category) {
          delete filter.categoryIds;
        }
      } catch (err) {
        console.error('Error querying grouped products in getAll:', err);
      }
    }

    // Match the positive price precedence used by storefront product cards.
    const effectivePrice = getEffectivePriceExpression();
    const priceConditions = buildPriceRangeConditions(
      queryParams,
      effectivePrice
    );
    if (priceConditions.length)
      filter.$expr = {
        $and: [{ $ne: [effectivePrice, null] }, ...priceConditions]
      };
    // Facet counts respect all other filters, but not the current audience selection.
    const facetFilter = { ...filter };
    const genders = getShopForGenders(queryParams.shopFor);
    if (genders.length) filter['basicInfo.gender'] = { $in: genders };
    const facetsQuery =
      queryParams.includeFacets === 'true'
        ? Promise.all(
            SHOP_FOR_OPTIONS.map(async (option) => ({
              value: option.value,
              label: option.label,
              count: await Product.countDocuments({
                ...facetFilter,
                'basicInfo.gender': { $in: option.genders }
              })
            }))
          )
        : Promise.resolve(undefined);
    const colorPopulation = {
      path: 'metalColorIds colorImages.metalColorId',
      select: 'name colorCode colorCodeEnd code hex'
    };
    const priceSort = {
      'price-low': 1,
      'price-high': -1,
      'price_asc': 1,
      'price_desc': -1,
    }[queryParams.sort];

    let fallbackSort = { productType: 1, 'meta.createdAt': -1, _id: -1 };
    if (queryParams.sort === 'name_asc') {
      fallbackSort = { 'basicInfo.title': 1, _id: -1 };
    }

    const itemQuery = priceSort
      ? Product.aggregate([
          { $match: Product.find(filter).cast(Product) },
          {
            $set: {
              cataloguePrice: effectivePrice,
              cataloguePriceMissing: {
                $cond: [{ $eq: [effectivePrice, null] }, 1, 0]
              }
            }
          },
          {
            $sort: {
              cataloguePriceMissing: 1,
              cataloguePrice: priceSort,
              _id: -1
            }
          },
          { $skip: skip },
          { $limit: limit },
          { $unset: ['cataloguePrice', 'cataloguePriceMissing'] }
        ]).then((products) => Product.populate(products, colorPopulation))
      : Product.find(filter)
          .populate(colorPopulation)
          .sort(fallbackSort)
          .skip(skip)
          .limit(limit)
          .lean();
    const [items, total, shopFor] = await Promise.all([
      itemQuery,
      Product.countDocuments(filter),
      facetsQuery
    ]);

    const wishlistedSet = await this._getWishlistSet(userId);
    const markInWishlist = (item) => {
      if (!item) return item;
      const itemId = String(item._id || item.id || '');
      return {
        ...item,
        inWishlist: wishlistedSet.has(itemId),
      };
    };

    const enrichedItems = (items || []).map((rawItem) => {
      const item = { ...rawItem };
      const group = groupMetaByRepId.get(String(item._id));
      if (group) {
        item.isGroup = true;
        item.groupCode = group.groupCode;
        item.groupName = group.groupName;
        item.title = group.groupName || item.basicInfo?.title;
        item.name = group.groupName || item.basicInfo?.title;
        if (item.basicInfo) {
          item.basicInfo = { ...item.basicInfo, title: group.groupName || item.basicInfo?.title };
        }
        item.memberProductIds = group.productIds;
        item.variantCount = group.productIds ? group.productIds.length : 1;
      }
      return withColorStatuses(item);
    });

    const finalItems = (queryParams.view === 'storefront'
      ? enrichedItems.map(formatStorefrontProduct)
      : enrichedItems).map(markInWishlist);

    const isPriceSort = queryParams.sort && ['price-low', 'price-high', 'price_asc', 'price_desc'].includes(queryParams.sort);
    if (!isPriceSort) {
      finalItems.sort((a, b) => {
        const isGoldA = (a.productType || a.representative?.productType || '').toLowerCase() === 'gold' ? 0 : 1;
        const isGoldB = (b.productType || b.representative?.productType || '').toLowerCase() === 'gold' ? 0 : 1;
        return isGoldA - isGoldB;
      });
    }

    return {
      items: finalItems,
      pagination: getPaginationMeta(total, page, limit),
      facets: shopFor ? { shopFor } : undefined
    };
  }

  // ------------------------------- get storefront products (lightweight listing) ----------------------------
  async getStorefrontProducts(queryParams = {}, userId = null) {
    return this.getAll({ ...queryParams, view: 'storefront' }, userId);
  }

  // ------------------------------- get search storefront products (streamlined info) ----------------------------
  async getSearchStorefront(queryParams = {}, userId = null) {
    await this.refreshCalculatedPrices();
    const { page, limit, skip } = getPagination(queryParams);
    const searchTerm = (queryParams.search || queryParams.q || '').trim();

    const conditions = [
      { 'meta.deletedAt': null },
      { status: 'approved' }
    ];

    let searchRegex = null;
    if (searchTerm) {
      const safeTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      searchRegex = new RegExp(safeTerm, 'i');
      conditions.push({
        $or: [
          { 'basicInfo.title': searchRegex },
          { 'basicInfo.slug': searchRegex },
          { 'basicInfo.sku': searchRegex },
          { 'basicInfo.description': searchRegex },
          { productType: searchRegex }
        ]
      });
    }

    if (queryParams.category) {
      conditions.push({ categoryIds: queryParams.category });
    }

    if (queryParams.menuItem) {
      conditions.push({ menuItemIds: queryParams.menuItem });
    }

    if (queryParams.productType && queryParams.productType !== 'all') {
      conditions.push({ productType: String(queryParams.productType).toLowerCase() });
    }

    if (queryParams.isOrnate !== undefined && queryParams.isOrnate !== '') {
      conditions.push({ isOrnate: queryParams.isOrnate === 'true' });
    }

    const genders = (queryParams.shopFor || queryParams.gender || '')
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);
    if (genders.length > 0) {
      conditions.push({ 'basicInfo.gender': { $in: genders } });
    }

    if (queryParams.minPrice || queryParams.maxPrice) {
      const priceFilter = {};
      if (queryParams.minPrice) priceFilter.$gte = Number(queryParams.minPrice);
      if (queryParams.maxPrice) priceFilter.$lte = Number(queryParams.maxPrice);
      conditions.push({
        $or: [
          { 'pricing.salePrice': priceFilter },
          { 'pricing.mrp': priceFilter }
        ]
      });
    }

    // Support representative group cards when requested (defaults to true for storefront)
    let groupMetaByRepId = new Map();
    const includeGroups = queryParams.includeGroups === 'true' || queryParams.includeGroups === true || queryParams.includeGroups === undefined;

    if (includeGroups) {
      try {
        const groupFilter = {
          status: 'active',
          'meta.deletedAt': null,
        };

        if (queryParams.category) {
          const catProductIds = await Product.find({
            categoryIds: queryParams.category,
            'meta.deletedAt': null,
          }).distinct('_id');

          groupFilter.$or = [
            { categoryId: queryParams.category },
            { productIds: { $in: catProductIds } },
          ];
        }

        const activeGroups = await ProductGroup.find(groupFilter)
          .select('_id groupCode groupName slug description productIds primaryProductId representativeMode categoryId')
          .lean();

        const repProductIds = [];
        for (const group of activeGroups) {
          let repId = group.primaryProductId;
          if (!repId && group.productIds?.length) {
            repId = await productGroupService.recalculateGroupRepresentative(group._id);
          }
          if (repId) {
            repProductIds.push(repId);
            groupMetaByRepId.set(String(repId), group);
          }
        }

        const allGroupedMemberIds = await ProductGroup.distinct('productIds', {
          status: 'active',
          'meta.deletedAt': null,
        });

        const standaloneFilter = {
          _id: { $nin: allGroupedMemberIds },
        };
        if (queryParams.category) {
          standaloneFilter.categoryIds = queryParams.category;
        }

        conditions.push({
          $or: [
            { _id: { $in: repProductIds } },
            standaloneFilter,
          ],
        });
      } catch (groupErr) {
        console.error('Error in search storefront group query:', groupErr);
      }
    }

    const filter = conditions.length === 1 ? conditions[0] : { $and: conditions };

    let sort = { 'meta.createdAt': -1, _id: -1 };
    if (queryParams.sort === 'price_asc') {
      sort = { 'pricing.salePrice': 1, _id: -1 };
    } else if (queryParams.sort === 'price_desc') {
      sort = { 'pricing.salePrice': -1, _id: -1 };
    } else if (queryParams.sort === 'oldest') {
      sort = { 'meta.createdAt': 1, _id: 1 };
    }

    const selectFields =
      '_id basicInfo pricing ornate productType isOrnate colorImages metalColorIds metalPurityIds variants centerDiamondRows stockStatus categoryIds menuItemIds meta';

    const [rawItems, total] = await Promise.all([
      Product.find(filter)
        .select(selectFields)
        .populate('metalColorIds colorImages.metalColorId', 'name colorCode colorCodeEnd code hex')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter)
    ]);

    const wishlistedSet = await this._getWishlistSet(userId);
    const enrichedItems = (rawItems || []).map((rawItem) => {
      const item = { ...rawItem };
      const group = groupMetaByRepId.get(String(item._id));
      if (group) {
        item.isGroup = true;
        item.groupCode = group.groupCode;
        item.groupName = group.groupName;
        item.title = group.groupName || item.basicInfo?.title;
        item.name = group.groupName || item.basicInfo?.title;
        if (item.basicInfo) {
          item.basicInfo = { ...item.basicInfo, title: group.groupName || item.basicInfo?.title };
        }
        item.memberProductIds = group.productIds;
        item.variantCount = group.productIds ? group.productIds.length : 1;
      }
      return item;
    });

    const items = enrichedItems.map(formatStorefrontProduct).map((item) => ({
      ...item,
      inWishlist: wishlistedSet.has(String(item._id || item.id || '')),
    }));

    return {
      items,
      pagination: getPaginationMeta(total, page, limit)
    };
  }

  // Helper to format concise product card info for the home page
  _formatHomeProduct(p) {
    return formatHomeProduct(p);
  }

  // ------------------------------- get home products (streamlined info) ----------------------------
  async getHomeProducts(queryParams = {}, userId = null) {
    await this.refreshCalculatedPrices();
    const limit = Math.min(Number(queryParams.limit) || 24, 50);
    const filter = {
      'meta.deletedAt': null,
      status: 'approved'
    };

    if (queryParams.category) {
      filter.categoryIds = queryParams.category;
    }
    if (queryParams.metalName) {
      filter.$or = [
        { 'ornate.metalName': new RegExp(queryParams.metalName, 'i') },
        { productType: new RegExp(queryParams.metalName, 'i') }
      ];
    }

    // Select ONLY needed fields from mongo to keep query ultra fast (no ornateImages for storefront)
    const selectFields =
      '_id colorImages metalColorIds stockStatus categoryIds basicInfo pricing ornate productType isOrnate';

    const items = await Product.find(filter)
      .select(selectFields)
      .populate('metalColorIds colorImages.metalColorId', 'name code colorCode colorCodeEnd')
      .sort({ 'meta.createdAt': -1, _id: -1 })
      .limit(limit)
      .lean();

    const wishlistedSet = await this._getWishlistSet(userId);
    const tagWishlist = (list) =>
      list.map((item) => ({
        ...item,
        inWishlist: wishlistedSet.has(String(item._id || item.id || '')),
      }));

    const formatted = tagWishlist(items.map((p) => formatHomeProduct(p)));

    // Curate sections for the home page storefront
    const gold = [];
    const silver = [];

    items.forEach((raw, i) => {
      const f = formatted[i];
      if (!f) return;
      const type = (raw.productType || '').toLowerCase();
      const isSilver = Boolean(raw.isOrnate || type === 'silver');

      if (type === 'gold') {
        gold.push(f);
      } else if (isSilver) {
        silver.push(f);
      } else {
        gold.push(f);
      }
    });

    const goldList = gold.slice(0, 8);
    const mostLovedList = [...goldList];
    if (mostLovedList.length < 8) {
      formatted.forEach((item) => {
        if (
          mostLovedList.length < 8 &&
          !mostLovedList.some((g) => String(g._id || g.id) === String(item._id || item.id))
        ) {
          mostLovedList.push(item);
        }
      });
    }

    const silverList = silver.slice(0, 8);
    const trendingList = formatted.slice(0, 8);

    return {
      items: formatted,
      sections: {
        gold: mostLovedList,
        mostLoved: mostLovedList,
        silver: silverList,
        trending: trendingList
      },
      gold: mostLovedList,
      mostLoved: mostLovedList,
      silver: silverList,
      trending: trendingList,
      total: formatted.length
    };
  }

  // ------------------------------- get product lookup ----------------------------
  async getLookup(queryParams = {}) {
    await this.refreshCalculatedPrices();
    const { page, limit, skip } = getPagination(queryParams);
    const conditions = [{ 'meta.deletedAt': null }];

    const resolvedLookupStatus = queryParams.status === 'active' ? 'approved' : queryParams.status;
    if (resolvedLookupStatus && resolvedLookupStatus !== 'all') {
      conditions.push({ status: resolvedLookupStatus });
    } else if (!resolvedLookupStatus) {
      conditions.push({ status: 'approved' });
    }

    const isOrnateSpecified =
      queryParams.isOrnate !== undefined && queryParams.isOrnate !== '';
    if (queryParams.productType && queryParams.productType !== 'all') {
      const typeCondition = buildLookupProductTypeFilter(
        queryParams.productType,
        isOrnateSpecified
      );
      if (typeCondition) conditions.push(typeCondition);
    }

    if (isOrnateSpecified) {
      const isO =
        queryParams.isOrnate === 'true' || queryParams.isOrnate === true;
      conditions.push({
        isOrnate: isO ? true : { $ne: true }
      });
    }

    if (queryParams.category) {
      conditions.push({ categoryIds: queryParams.category });
    }

    if (queryParams.search) {
      const searchConditions = buildProductSearchFilter(queryParams.search);
      if (searchConditions) {
        conditions.push({ $or: searchConditions });
      }
    }

    const filter =
      conditions.length === 1 ? conditions[0] : { $and: conditions };

    const [rawItems, total] = await Promise.all([
      Product.find(filter)
        .select(
          '_id basicInfo categoryIds colorImages ornate pricing productType isOrnate specifications status images'
        )
        .populate({
          path: 'categoryIds',
          select: 'name slug',
          strictPopulate: false
        })
        .sort({ 'meta.createdAt': -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter)
    ]);

    const items = rawItems.map((p) => formatLookupProduct(p));

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- update product ----------------------------
  async update(id, data) {
    if (data.status && data.status !== 'approved' && data.status !== 'draft') {
      data.status = 'draft';
    }
    const existing = await Product.findById(id).lean();
    if (!existing) throw new ApiError(404, 'Product not found');
    const isSilver = (data.productType ?? existing.productType) === 'silver' || Boolean(data.isOrnate ?? existing.isOrnate);
    if (!isSilver) {
      const combined = {
        ...existing,
        ...data,
        pricing: { ...existing.pricing, ...data.pricing },
        specifications: { ...existing.specifications, ...data.specifications }
      };
      const calculated = await this.applyPricing(combined);
      data = {
        ...data,
        variants: calculated.variants,
        pricing: calculated.pricing
      };
    }
    if (data.colorImages) {
      data.colorImages = sanitizeColorImages(data.colorImages);
    }
    if (data.basicInfo?.sku) {
      const duplicate = await Product.findOne({
        'basicInfo.sku': data.basicInfo.sku,
        _id: { $ne: id }
      });
      if (duplicate) {
        throw new ApiError(
          409,
          `Product with SKU "${data.basicInfo.sku}" already exists`
        );
      }
    }

    const isOrnate = Boolean(data.isOrnate ?? existing.isOrnate);
    if (isOrnate) {
      const title = data.basicInfo?.title ?? existing.basicInfo?.title;
      const barcode = data.ornate?.barcode ?? existing.ornate?.barcode ?? data.barcode ?? existing.barcode;
      if (title) {
        const fallbackId = data.basicInfo?.sku ?? existing.basicInfo?.sku ?? '';
        const slugBase = barcode ? `${title}-${barcode}` : (fallbackId ? `${title}-${fallbackId}` : title);
        const newSlug = slugBase
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        if (data.basicInfo) {
          data.basicInfo.slug = newSlug;
        } else {
          data['basicInfo.slug'] = newSlug;
        }
      }
    }

    const product = await Product.findOneAndUpdate(
      { _id: id },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    );

    if (!product) {
      throw new ApiError(404, 'Product not found');
    }

    try {
      await productGroupService.refreshAffectedGroups(product._id);
    } catch (err) {
      console.error(`Error refreshing groups after product update (${id}):`, err);
    }

    return product;
  }

  // ------------------------------- delete product ----------------------------
  async delete(id) {
    const product = await Product.findOneAndUpdate(
      { _id: id },
      { $set: { status: 'draft', 'meta.deletedAt': new Date() } },
      { returnDocument: 'after' }
    );

    if (!product) {
      throw new ApiError(404, 'Product not found');
    }

    try {
      await productGroupService.refreshAffectedGroups(id);
    } catch (err) {
      console.error(`Error refreshing groups after product delete (${id}):`, err);
    }

    return { message: 'Product deleted successfully', id };
  }

  // ------------------------------- get storefront filters (single lightweight common API) ----------------------------
  async getStorefrontFilters(queryParams = {}) {
    const activeFilter = { 'meta.deletedAt': null, status: 'active' };

    const [diamondTypes, diamondClarities, caratWeights, collections] = await Promise.all([
      DiamondType.find(activeFilter).sort({ name: 1 }).select('_id name').lean(),
      DiamondClarity.find(activeFilter).sort({ name: 1 }).select('_id name').lean(),
      CaratWeight.find(activeFilter).sort({ order: 1, weight: 1, name: 1 }).select('_id name weight').lean(),
      Featured.find(activeFilter).sort({ order: 1, name: 1 }).select('_id name').lean(),
    ]);

    // Format clean data arrays returning ONLY frontend needed value and _id
    const formattedDiamondTypes = diamondTypes.map((item) => ({
      _id: item._id,
      name: item.name,
      value: item.name,
    }));

    const formattedDiamondClarities = diamondClarities.map((item) => ({
      _id: item._id,
      name: item.name,
      value: item.name,
    }));

    const formattedCaratWeights = caratWeights.map((item) => ({
      _id: item._id,
      name: item.name || (item.weight ? `${item.weight} Ct` : ''),
      value: item.weight ? `${item.weight} Ct` : (item.name || ''),
      weight: item.weight,
    }));

    const formattedCollections = collections.map((item) => ({
      _id: item._id,
      name: item.name,
      title: item.name,
      value: item.name,
    }));

    const genders = [
      { _id: 'Women', name: 'Women', value: 'Women' },
      { _id: 'Men', name: 'Men', value: 'Men' },
      { _id: 'Kids', name: 'Kids', value: 'Kids' },
      { _id: 'Unisex', name: 'Unisex', value: 'Unisex' },
    ];

    const filterGroups = [
      { id: 'carat-weights', title: 'Diamond Weight', key: 'carat', options: formattedCaratWeights },
      { id: 'diamond-types', title: 'Diamond Type', key: 'diamondType', options: formattedDiamondTypes },
      { id: 'collections', title: 'Collections', key: 'collection', options: formattedCollections },
      { id: 'diamond-clarities', title: 'Diamond Clarities', key: 'clarity', options: formattedDiamondClarities },
      { id: 'gender', title: 'Gender', key: 'shopFor', options: genders },
    ];

    if (queryParams.format === 'array') {
      return filterGroups;
    }

    return {
      diamondTypes: formattedDiamondTypes,
      diamondClarities: formattedDiamondClarities,
      caratWeights: formattedCaratWeights,
      collections: formattedCollections,
      genders,
      filters: filterGroups,
    };
  }
}

module.exports = new ProductService();
