const mongoose = require('mongoose');
const Product = require('./product.model');
const {
  calculateProductPricing,
  loadPricingMasters
} = require('./product.pricing');
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
    if (data.pricing?.calculationMode !== 'automatic') return data;
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
        'pricing.calculationMode': 'automatic',
        'meta.deletedAt': null
      }).lean();
      if (!products.length) return;
      const masters = await loadPricingMasters();
      const writes = [];
      for (const product of products) {
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
    if (data.status === 'active') {
      data.status = 'approved';
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

    return await Product.create(await this.applyPricing(data));
  }

  // ------------------------------- get one product ----------------------------
  async getOne(id) {
    await this.refreshCalculatedPrices();
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const filter = isObjectId
      ? {
          $or: [
            { _id: id },
            { 'basicInfo.slug': id },
            { 'basicInfo.sku': id },
            { 'ornate.tagNo': id }
          ]
        }
      : {
          $or: [
            { 'basicInfo.slug': id },
            { 'basicInfo.sku': id },
            { 'ornate.tagNo': id }
          ]
        };

    let product = await Product.findOne(filter)
      .populate({
        path: 'categoryIds',
        select: 'name slug sizeChart',
        strictPopulate: false
      })
      .populate({
        path: 'metalColorIds',
        select: 'name code colorCode colorCodeEnd',
        strictPopulate: false
      })
      .populate({
        path: 'metalPurityIds',
        select: 'name karat metalType',
        strictPopulate: false
      })
      .populate({
        path: 'colorImages.metalColorId',
        select: 'name code colorCode colorCodeEnd',
        strictPopulate: false
      })
      .populate({
        path: 'variants.metalColorId',
        select: 'name code colorCode colorCodeEnd',
        strictPopulate: false
      })
      .populate({
        path: 'variants.metalPurityId',
        select: 'name karat metalType',
        strictPopulate: false
      })
      .populate({
        path: 'variants.diamondTypeId',
        select: 'name',
        strictPopulate: false
      })
      .populate({
        path: 'variants.diamondShapeId',
        select: 'name',
        strictPopulate: false
      })
      .populate({
        path: 'variants.diamondColorId',
        select: 'name',
        strictPopulate: false
      })
      .populate({
        path: 'variants.diamondClarityId',
        select: 'name',
        strictPopulate: false
      })
      .lean();

    if (!product && !isObjectId) {
      const candidates = await Product.find({ 'basicInfo.title': { $exists: true, $ne: '' } }).select('_id basicInfo.title').lean();
      const matched = candidates.find((cand) => {
        const titleSlug = (cand.basicInfo?.title || '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        return titleSlug === String(id).toLowerCase();
      });
      if (matched) {
        await Product.updateOne({ _id: matched._id }, { $set: { 'basicInfo.slug': id } });
        return this.getOne(String(matched._id));
      }
    }

    if (!product) {
      throw new ApiError(404, 'Product not found');
    }

    return withColorStatuses(product);
  }

  // ------------------------------- get product by sku or tag ----------------------------
  async getBySkuOrTag(code) {
    await this.refreshCalculatedPrices();
    const product = await Product.findOne({
      $or: [{ 'basicInfo.sku': code }, { 'ornate.tagNo': code }]
    }).lean();
    if (!product) {
      throw new ApiError(404, `Product with SKU/Tag "${code}" not found`);
    }
    return withColorStatuses(product);
  }

  // ------------------------------- get all products ----------------------------
  async getAll(queryParams = {}) {
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

    if (queryParams.status) {
      filter.status = queryParams.status;
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

    // Grouping support: if includeGroups is requested, group products into representative group cards
    let groupCards = [];
    if (queryParams.includeGroups === 'true') {
      try {
        const ProductGroup = require('../productGroup/productGroup.model');
        const productGroupService = require('../productGroup/productGroup.service');

        const activeGroups = await ProductGroup.find({
          status: 'active',
          'meta.deletedAt': null
        })
          .populate({
            path: 'productIds',
            select:
              '_id basicInfo pricing specifications ornate colorImages status stockStatus productType isOrnate categoryIds menuItemIds meta'
          })
          .lean();

        const groupedProductIds = [];

        for (const group of activeGroups) {
          if (!group.productIds || !group.productIds.length) continue;
          group.productIds.forEach((p) => {
            if (p?._id) groupedProductIds.push(p._id);
          });

          const summary = productGroupService.computeGroupSummary(
            group,
            group.productIds
          );
          if (!summary.representative) continue;

          const rep = summary.representative;
          const allCategoryIds = [
            ...new Set(
              group.productIds.flatMap((p) => (p.categoryIds || []).map(String))
            )
          ];
          const allMenuItemIds = [
            ...new Set(
              group.productIds.flatMap((p) => (p.menuItemIds || []).map(String))
            )
          ];
          const allGenders = [
            ...new Set(
              group.productIds.flatMap((p) => {
                const g = p.basicInfo?.gender;
                return Array.isArray(g) ? g : g ? [g] : [];
              })
            )
          ];

          const repCategoryIds = (rep.categoryIds || []).map(String);
          const repMenuItemIds = (rep.menuItemIds || []).map(String);
          const repGenders = Array.isArray(rep.basicInfo?.gender)
            ? rep.basicInfo.gender
            : rep.basicInfo?.gender
            ? [rep.basicInfo.gender]
            : Array.isArray(rep.gender)
            ? rep.gender
            : rep.gender
            ? [rep.gender]
            : [];

          const groupCategoryIds = [
            ...new Set([
              ...allCategoryIds,
              ...repCategoryIds,
              ...(group.categoryId ? [String(group.categoryId)] : [])
            ])
          ];
          const groupMenuItemIds = [
            ...new Set([
              ...allMenuItemIds,
              ...repMenuItemIds,
              ...(group.menuItemId ? [String(group.menuItemId)] : [])
            ])
          ];
          const groupGender = [
            ...new Set([
              ...allGenders.map(String),
              ...repGenders.map(String)
            ])
          ];

          // 1. Filter by category
          if (queryParams.category) {
            const requestedCat = String(queryParams.category);
            if (!groupCategoryIds.includes(requestedCat)) {
              continue;
            }
          }

          // 2. Filter by menuItem
          if (queryParams.menuItem) {
            const requestedMenuItem = String(queryParams.menuItem);
            if (!groupMenuItemIds.includes(requestedMenuItem)) {
              continue;
            }
          }

          // 3. Filter by status
          if (queryParams.status && queryParams.status !== 'all') {
            const reqStatus = String(queryParams.status).toLowerCase();
            const groupStatus = String(group.status || '').toLowerCase();
            const repStatus = String(rep.status || '').toLowerCase();
            if (reqStatus === 'active') {
              if (groupStatus !== 'active' && repStatus !== 'active' && repStatus !== 'approved') {
                continue;
              }
            } else if (groupStatus !== reqStatus && repStatus !== reqStatus) {
              continue;
            }
          }

          // 4. Filter by productType
          if (queryParams.productType && queryParams.productType !== 'all') {
            const reqPt = String(queryParams.productType).toLowerCase();
            const repPt = String(rep.productType || '').toLowerCase();
            const hasPt = group.productIds.some(
              (p) => String(p.productType || '').toLowerCase() === reqPt
            ) || repPt === reqPt;
            if (!hasPt) {
              continue;
            }
            if (reqPt === 'silver' && !isOrnateSpecified) {
              const hasNonOrnateSilver = group.productIds.some(
                (p) => String(p.productType || '').toLowerCase() === 'silver' && p.isOrnate !== true
              ) || (repPt === 'silver' && rep.isOrnate !== true);
              if (!hasNonOrnateSilver) {
                continue;
              }
            }
          }

          // 5. Filter by isOrnate
          if (isOrnateSpecified) {
            const isO = queryParams.isOrnate === 'true' || queryParams.isOrnate === true;
            const matchesOrnate = isO
              ? (rep.isOrnate === true || group.productIds.some((p) => p.isOrnate === true))
              : (rep.isOrnate !== true || group.productIds.some((p) => p.isOrnate !== true));
            if (!matchesOrnate) {
              continue;
            }
          }

          // 6. Filter by shopFor / gender
          const shopForGenders = getShopForGenders(queryParams.shopFor);
          if (shopForGenders.length > 0) {
            const matchesShopFor = groupGender.some((g) =>
              shopForGenders.some((sfg) => String(sfg).toLowerCase() === String(g).toLowerCase())
            );
            if (!matchesShopFor) {
              continue;
            }
          }
          if (queryParams.gender) {
            const targetGender = String(queryParams.gender).toLowerCase();
            const matchesGender = groupGender.some(
              (g) => String(g).toLowerCase() === targetGender
            );
            if (!matchesGender) {
              continue;
            }
          }

          // 7. Filter by search
          if (queryParams.search) {
            const term = queryParams.search.trim().toLowerCase();
            const matchesSearch =
              (group.groupName && group.groupName.toLowerCase().includes(term)) ||
              (group.groupCode && group.groupCode.toLowerCase().includes(term)) ||
              (group.description && group.description.toLowerCase().includes(term)) ||
              (rep.basicInfo?.title && rep.basicInfo.title.toLowerCase().includes(term)) ||
              (rep.basicInfo?.sku && rep.basicInfo.sku.toLowerCase().includes(term)) ||
              group.productIds.some(
                (p) =>
                  (p.basicInfo?.title && p.basicInfo.title.toLowerCase().includes(term)) ||
                  (p.basicInfo?.sku && p.basicInfo.sku.toLowerCase().includes(term)) ||
                  (p.ornate?.tagNo && p.ornate.tagNo.toLowerCase().includes(term)) ||
                  (p.ornate?.itemCode && p.ornate.itemCode.toLowerCase().includes(term)) ||
                  (p.ornate?.groupName && p.ornate.groupName.toLowerCase().includes(term))
              );
            if (!matchesSearch) {
              continue;
            }
          }

          // 8. Filter by price range
          const effectiveGroupPrice = summary.representativePrice || summary.maxPrice || 0;
          if (queryParams.minPrice !== undefined && queryParams.minPrice !== '') {
            const minP = Number(queryParams.minPrice);
            if (Number.isFinite(minP)) {
              if (effectiveGroupPrice < minP && (summary.maxPrice || 0) < minP) {
                continue;
              }
            }
          }
          if (queryParams.maxPrice !== undefined && queryParams.maxPrice !== '') {
            const maxP = Number(queryParams.maxPrice);
            if (Number.isFinite(maxP)) {
              if (effectiveGroupPrice > maxP && (summary.minPrice || 0) > maxP) {
                continue;
              }
            }
          }

          groupCards.push({
            _id: group._id,
            isGroup: true,
            groupCode: group.groupCode,
            groupName: group.groupName,
            name: group.groupName,
            slug: group.slug || rep.basicInfo?.slug,
            basicInfo: {
              title: group.groupName,
              slug: group.slug || rep.basicInfo?.slug,
              description: group.description || rep.basicInfo?.description || '',
              gender: groupGender,
            },
            pricing: {
              salePrice: summary.representativePrice,
              mrp: rep.pricing?.mrp || summary.representativePrice,
              minPrice: summary.minPrice,
              maxPrice: summary.maxPrice
            },
            variantCount: summary.eligibleCount,
            colorImages: rep.colorImages,
            images: rep.images,
            ornate: rep.ornate,
            stockStatus: rep.stockStatus,
            status: 'approved',
            productType: rep.productType,
            isOrnate: rep.isOrnate,
            categoryIds: groupCategoryIds,
            menuItemIds: groupMenuItemIds,
            gender: groupGender,
            memberProductIds: group.productIds.map((p) => p._id),
            representative: rep,
            meta: group.meta
          });
        }

        if (queryParams.sort) {
          if (queryParams.sort === 'price-low' || queryParams.sort === 'price_asc') {
            groupCards.sort((a, b) => (a.pricing?.salePrice || 0) - (b.pricing?.salePrice || 0));
          } else if (queryParams.sort === 'price-high' || queryParams.sort === 'price_desc') {
            groupCards.sort((a, b) => (b.pricing?.salePrice || 0) - (a.pricing?.salePrice || 0));
          } else if (queryParams.sort === 'name_asc') {
            groupCards.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          }
        }

        if (groupedProductIds.length > 0) {
          filter._id = { $nin: groupedProductIds };
        }
      } catch (err) {
        console.error('Error folding groups in getAll:', err);
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
      select: 'name code hex'
    };
    const priceSort = {
      'price-low': 1,
      'price-high': -1,
      'price_asc': 1,
      'price_desc': -1,
    }[queryParams.sort];

    let fallbackSort = { 'meta.createdAt': -1, _id: -1 };
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

    if (queryParams.includeGroups === 'true' && groupCards.length > 0) {
      const displayedGroupCards = page === 1 ? groupCards : [];
      const combined = [
        ...displayedGroupCards,
        ...items.map(withColorStatuses)
      ];
      const finalItems = queryParams.view === 'storefront'
        ? combined.map(formatStorefrontProduct)
        : combined;
      return {
        items: finalItems,
        pagination: getPaginationMeta(total + groupCards.length, page, limit),
        facets: shopFor ? { shopFor } : undefined
      };
    }

    const finalItems = queryParams.view === 'storefront'
      ? items.map(formatStorefrontProduct)
      : items.map(withColorStatuses);

    return {
      items: finalItems,
      pagination: getPaginationMeta(total, page, limit),
      facets: shopFor ? { shopFor } : undefined
    };
  }

  // ------------------------------- get storefront products (lightweight listing) ----------------------------
  async getStorefrontProducts(queryParams = {}) {
    return this.getAll({ ...queryParams, view: 'storefront' });
  }

  // ------------------------------- get search storefront products (streamlined info) ----------------------------
  async getSearchStorefront(queryParams = {}) {
    await this.refreshCalculatedPrices();
    const { page, limit, skip } = getPagination(queryParams);
    const searchTerm = (queryParams.search || queryParams.q || '').trim();

    const conditions = [
      { 'meta.deletedAt': null },
      { status: { $in: ['active', 'approved'] } }
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
          { 'ornate.tagNo': searchRegex },
          { 'ornate.itemCode': searchRegex },
          { 'ornate.barcode': searchRegex },
          { 'ornate.groupName': searchRegex },
          { 'ornate.customGroupName': searchRegex },
          { 'ornate.metalName': searchRegex },
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
    let groupCards = [];
    const includeGroups = queryParams.includeGroups === 'true' || queryParams.includeGroups === true;
    const groupedProductIds = [];

    if (includeGroups) {
      try {
        const ProductGroup = require('../productGroup/productGroup.model');
        const productGroupService = require('../productGroup/productGroup.service');
        const groupFilter = {
          status: 'active',
          'meta.deletedAt': null
        };
        if (searchRegex) {
          groupFilter.name = searchRegex;
        }

        const activeGroups = await ProductGroup.find(groupFilter)
          .populate({
            path: 'productIds',
            select:
              '_id basicInfo pricing specifications ornate colorImages status stockStatus productType isOrnate categoryIds menuItemIds meta'
          })
          .lean();

        for (const group of activeGroups) {
          if (!group.productIds || !group.productIds.length) continue;
          group.productIds.forEach((p) => {
            if (p?._id) groupedProductIds.push(p._id);
          });

          const summary = productGroupService.computeGroupSummary(
            group,
            group.productIds
          );
          if (!summary.representative) continue;
          const rep = summary.representative;

          if (queryParams.category) {
            const allCatIds = [
              ...group.productIds.flatMap((p) => (p.categoryIds || []).map(String)),
              ...(group.categoryId ? [String(group.categoryId)] : [])
            ];
            if (!allCatIds.includes(String(queryParams.category))) continue;
          }

          if (queryParams.menuItem) {
            const allMenuIds = [
              ...group.productIds.flatMap((p) => (p.menuItemIds || []).map(String)),
              ...(group.menuItemId ? [String(group.menuItemId)] : [])
            ];
            if (!allMenuIds.includes(String(queryParams.menuItem))) continue;
          }

          groupCards.push({
            ...rep,
            _id: group._id,
            id: group._id,
            groupName: group.name,
            slug: group.slug || rep.basicInfo?.slug,
            isGroup: true,
            variantCount: group.productIds.length,
            images: rep.colorImages?.flatMap((c) => c.images?.map((img) => img.url)) || [],
            pricing: {
              ...rep.pricing,
              minPrice: summary.minPrice,
              maxPrice: summary.maxPrice,
              salePrice: summary.minPrice
            }
          });
        }
      } catch (groupErr) {
        // Silently continue without groups if error occurs
      }
    }

    if (groupedProductIds.length > 0) {
      conditions.push({ _id: { $nin: groupedProductIds } });
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
      '_id basicInfo pricing ornate productType isOrnate colorImages stockStatus categoryIds menuItemIds meta';

    const [rawItems, total] = await Promise.all([
      Product.find(filter)
        .select(selectFields)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter)
    ]);

    const displayedGroupCards = page === 1 ? groupCards.map(formatStorefrontProduct) : [];
    const formattedProducts = rawItems.map(formatStorefrontProduct);
    const items = [...displayedGroupCards, ...formattedProducts];

    return {
      items,
      pagination: getPaginationMeta(total + groupCards.length, page, limit)
    };
  }

  // Helper to format concise product card info for the home page
  _formatHomeProduct(p) {
    return formatHomeProduct(p);
  }

  // ------------------------------- get home products (streamlined info) ----------------------------
  async getHomeProducts(queryParams = {}) {
    await this.refreshCalculatedPrices();
    const limit = Math.min(Number(queryParams.limit) || 24, 50);
    const filter = {
      'meta.deletedAt': null,
      status: { $in: ['approved', 'active'] }
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

    const formatted = items.map((p) => formatHomeProduct(p));

    // Curate sections for the home page storefront
    const platinum = [];
    const silver = [];
    items.forEach((raw, i) => {
      const f = formatted[i];
      if (!f) return;
      const isSilver = Boolean(raw.isOrnate || raw.productType?.toLowerCase() === 'silver');
      if (isSilver) {
        if (silver.length < 5) silver.push(f);
      } else {
        if (platinum.length < 5) platinum.push(f);
      }
    });
    const trending = formatted.slice(0, 5);

    const platinumList = platinum.length > 0 ? platinum : formatted.slice(0, 5);
    const silverList = silver.length > 0 ? silver : formatted.slice(5, 10);
    const trendingList = trending.length > 0 ? trending : formatted.slice(0, 5);

    return {
      items: formatted,
      sections: {
        platinum: platinumList,
        silver: silverList,
        trending: trendingList
      },
      platinum: platinumList,
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

    if (queryParams.status && queryParams.status !== 'all') {
      conditions.push({ status: queryParams.status });
    } else if (!queryParams.status) {
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
          '_id basicInfo categoryIds colorImages ornate pricing productType isOrnate specifications status'
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
    if (data.status === 'active') {
      data.status = 'approved';
    }
    const existing = await Product.findById(id).lean();
    if (!existing) throw new ApiError(404, 'Product not found');
    if (
      (data.pricing?.calculationMode ?? existing.pricing?.calculationMode) ===
      'automatic'
    ) {
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

    const product = await Product.findOneAndUpdate(
      { _id: id },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    );

    if (!product) {
      throw new ApiError(404, 'Product not found');
    }

    return product;
  }

  // ------------------------------- delete product ----------------------------
  async delete(id) {
    const product = await Product.findOneAndUpdate(
      { _id: id },
      { $set: { status: 'inactive', 'meta.deletedAt': new Date() } },
      { returnDocument: 'after' }
    );

    if (!product) {
      throw new ApiError(404, 'Product not found');
    }

    return { message: 'Product deleted successfully', id };
  }
}

module.exports = new ProductService();
