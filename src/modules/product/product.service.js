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

    return await Product.create(await this.applyPricing(data));
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

    const populateOptions = [
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

    return withColorStatuses({ ...product, certificateImage, inWishlist });
  }

  // ------------------------------- get product by sku or tag ----------------------------
  async getBySkuOrTag(code, userId = null) {
    await this.refreshCalculatedPrices();
    const product = await Product.findOne({
      $or: [{ 'basicInfo.sku': code }, { 'ornate.tagNo': code }]
    }).lean();
    if (!product) {
      throw new ApiError(404, `Product with SKU/Tag "${code}" not found`);
    }

    const setting = await Setting.findOne().select('certificateImage').lean();
    const certificateImage = product.certificateImage?.url
      ? product.certificateImage
      : setting?.certificateImage || null;

    const wishlistedSet = await this._getWishlistSet(userId);
    const inWishlist = wishlistedSet.has(String(product._id));

    return withColorStatuses({ ...product, certificateImage, inWishlist });
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

    if (queryParams.view === 'storefront') {
      filter.status = 'approved';
    } else if (queryParams.status && queryParams.status !== 'all') {
      filter.status = queryParams.status;
    } else if (!queryParams.status) {
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

    // Grouping support: if includeGroups is requested, group products into representative group cards
    let groupCards = [];
    if (queryParams.includeGroups === 'true') {
      try {
        const activeGroups = await ProductGroup.find({
          status: 'active',
          'meta.deletedAt': null
        })
          .populate({
            path: 'productIds',
            select:
              '_id basicInfo pricing specifications ornate colorImages metalColorIds status stockStatus productType isOrnate categoryIds menuItemIds meta',
            populate: {
              path: 'metalColorIds colorImages.metalColorId',
              select: 'name colorCode colorCodeEnd code hex'
            }
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
          const reqStatus = queryParams.view === 'storefront' ? 'approved' : queryParams.status;
          if (reqStatus && reqStatus !== 'all') {
            const targetStatus = String(reqStatus).toLowerCase();
            const repStatus = String(rep.status || '').toLowerCase();
            if (repStatus !== targetStatus) {
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

          const repSlug = rep.basicInfo?.slug || (group.slug ? group.slug.replace(/-\d{6}$/, '') : '');
          const cleanGroupTitle = (group.productIds?.length === 1 && rep.basicInfo?.title)
            ? rep.basicInfo.title
            : (group.groupName ? group.groupName.replace(/\s+-\s+\d+$/, '') : group.groupName);

          groupCards.push({
            _id: group._id,
            isGroup: true,
            groupCode: group.groupCode,
            groupName: cleanGroupTitle,
            name: cleanGroupTitle,
            title: cleanGroupTitle,
            slug: repSlug,
            basicInfo: {
              title: cleanGroupTitle,
              slug: repSlug,
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
            metalColorIds: rep.metalColorIds,
            metalColors: rep.metalColors,
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

    if (queryParams.includeGroups === 'true' && groupCards.length > 0) {
      const displayedGroupCards = page === 1 ? groupCards : [];
      let combined = [
        ...displayedGroupCards,
        ...items.map(withColorStatuses)
      ];

      // 1st display gold products, then silver products (unless explicit price sort)
      const isPriceSort = queryParams.sort && ['price-low', 'price-high', 'price_asc', 'price_desc'].includes(queryParams.sort);
      if (!isPriceSort) {
        combined.sort((a, b) => {
          const isGoldA = (a.productType || a.representative?.productType || '').toLowerCase() === 'gold' ? 0 : 1;
          const isGoldB = (b.productType || b.representative?.productType || '').toLowerCase() === 'gold' ? 0 : 1;
          return isGoldA - isGoldB;
        });
      }

      const finalItems = (queryParams.view === 'storefront'
        ? combined.map(formatStorefrontProduct)
        : combined).map(markInWishlist);
      return {
        items: finalItems,
        pagination: getPaginationMeta(total + groupCards.length, page, limit),
        facets: shopFor ? { shopFor } : undefined
      };
    }

    const finalItems = (queryParams.view === 'storefront'
      ? items.map(formatStorefrontProduct)
      : items.map(withColorStatuses)).map(markInWishlist);

    if (!priceSort) {
      finalItems.sort((a, b) => {
        const isGoldA = (a.productType || '').toLowerCase() === 'gold' ? 0 : 1;
        const isGoldB = (b.productType || '').toLowerCase() === 'gold' ? 0 : 1;
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
              '_id basicInfo pricing specifications ornate colorImages metalColorIds status stockStatus productType isOrnate categoryIds menuItemIds meta',
            populate: {
              path: 'metalColorIds colorImages.metalColorId',
              select: 'name colorCode colorCodeEnd code hex'
            }
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

          const repSlug = rep.basicInfo?.slug || (group.slug ? group.slug.replace(/-\d{6}$/, '') : '');
          const cleanGroupTitle = (group.productIds?.length === 1 && rep.basicInfo?.title)
            ? rep.basicInfo.title
            : (group.name || group.groupName ? (group.name || group.groupName).replace(/\s+-\s+\d+$/, '') : '');

          groupCards.push({
            ...rep,
            _id: group._id,
            id: group._id,
            groupName: cleanGroupTitle,
            name: cleanGroupTitle,
            title: cleanGroupTitle,
            slug: repSlug,
            basicInfo: {
              ...(rep.basicInfo || {}),
              title: cleanGroupTitle,
              slug: repSlug,
            },
            isGroup: true,
            variantCount: group.productIds.length,
            colorImages: rep.colorImages,
            metalColorIds: rep.metalColorIds,
            metalColors: rep.metalColors,
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
    const displayedGroupCards = page === 1 ? groupCards.map(formatStorefrontProduct) : [];
    const formattedProducts = rawItems.map(formatStorefrontProduct);
    const items = [...displayedGroupCards, ...formattedProducts].map((item) => ({
      ...item,
      inWishlist: wishlistedSet.has(String(item._id || item.id || '')),
    }));

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
    const platinum = [];

    items.forEach((raw, i) => {
      const f = formatted[i];
      if (!f) return;
      const type = (raw.productType || '').toLowerCase();
      const isSilver = Boolean(raw.isOrnate || type === 'silver');

      if (type === 'gold') {
        gold.push(f);
      } else if (isSilver) {
        silver.push(f);
      } else if (type === 'platinum') {
        platinum.push(f);
      } else {
        gold.push(f);
      }
    });

    // Preferred order matching home page "Most Loved on Neirah"
    const preferredOrder = [
      'round diamond channel set huggie hoop',
      'round cut diamond statement huggie hoop',
      'round & baguette diamond halo huggie hoop',
      'diamond mixed cut geometric cluster hoop',
      'round cut diamond gold heart drop hoop'
    ];

    const sortedGold = [...gold].sort((a, b) => {
      const aTitle = (a.basicInfo?.title || a.title || '').toLowerCase();
      const bTitle = (b.basicInfo?.title || b.title || '').toLowerCase();
      const aIdx = preferredOrder.findIndex((prefix) => aTitle.includes(prefix));
      const bIdx = preferredOrder.findIndex((prefix) => bTitle.includes(prefix));
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return 0;
    });

    const goldList = sortedGold.length > 0 ? sortedGold.slice(0, 8) : formatted.filter((p) => p.productType === 'gold').slice(0, 8);
    const mostLovedList = [...goldList];
    if (mostLovedList.length < 8) {
      formatted.forEach((item) => {
        if (mostLovedList.length < 8 && !mostLovedList.some((g) => String(g._id || g.id) === String(item._id || item.id))) {
          mostLovedList.push(item);
        }
      });
    }

    const silverList = silver.length > 0 ? silver.slice(0, 8) : formatted.filter((p) => p.productType === 'silver').slice(0, 8);
    const platinumList = platinum.length > 0 ? platinum.slice(0, 8) : [];
    const trendingList = formatted.slice(0, 8);

    return {
      items: formatted,
      sections: {
        gold: mostLovedList,
        mostLoved: mostLovedList,
        platinum: platinumList,
        silver: silverList,
        trending: trendingList
      },
      gold: mostLovedList,
      mostLoved: mostLovedList,
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
