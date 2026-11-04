const mongoose = require('mongoose');
const Product = require('./product.model');
const Setting = require('../setting/setting.model');
const {
  calculateProductPricing,
  calculateCustomPriceBreakdown,
  loadPricingMasters
} = require('./product.pricing');
const {
  resolveProductByCodeOrId,
  getWishlistSet,
  populateMediaSizes,
  buildAdminFilter,
} = require('./product.query');
const DiamondType = require('../diamondType/diamondType.model');
const DiamondClarity = require('../diamondClarity/diamondClarity.model');
const Featured = require('../featured/featured.model');
const Wishlist = require('../wishlist/wishlist.model');
const Category = require('../category/category.model');
const ProductGroup = require('../productGroup/productGroup.model');
const productGroupService = require('../productGroup/productGroup.service');
const { SHOP_FOR_OPTIONS, getShopForGenders } = require('./product.filters');
const ApiError = require('../../utils/ApiError');
const { getRequestContext } = require('../../utils/context');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const cloudflareR2 = require('../../utils/cloudflareR2');
const {
  withColorStatuses,
  sanitizeColorImages,
  isPricingUnchanged,
  formatHomeProduct,
  formatStorefrontProduct,
  formatStorefrontProductDetail,
  formatLookupProduct,
  buildProductSearchFilter,
  buildProductTypeFilter,
  buildLookupProductTypeFilter,
  getEffectivePriceExpression,
  buildPriceRangeConditions,
  getProductPopulateOptions,
  extractSizeChart,
  formatSizeChart,
} = require('./product.utils');

class ProductService {
  async _populateMediaSizes(product) {
    return populateMediaSizes(product);
  }

  async calculateCustomPrice(data) {
    return calculateCustomPriceBreakdown(data);
  }
  async previewPricing(data) {
    return calculateProductPricing(data, await loadPricingMasters());
  }

  async applyPricing(data) {
    if (data.productType === 'silver' || Boolean(data.isOrnate)) return data;
    const metalWeight = Number(data.specifications?.metalWeight);
    if (!metalWeight || metalWeight <= 0) {
      return data;
    }
    try {
      const result = await this.previewPricing(data);
      return {
        ...data,
        variants: result.variants,
        pricing: { ...data.pricing, salePrice: result.salePrice }
      };
    } catch (err) {
      console.warn('Could not auto-calculate pricing on product save:', err.message);
      return data;
    }
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
  async create(data, userId) {
    const actorId = userId || getRequestContext('userId');
    if (actorId) {
      if (!data.meta) data.meta = {};
      if (!data.meta.createdBy) data.meta.createdBy = actorId;
      if (!data.meta.updatedBy) data.meta.updatedBy = actorId;
    }
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
    return getWishlistSet(userId);
  }

  // ------------------------------- get one product ----------------------------
  async getOne(id, userId = null) {
    await this.refreshCalculatedPrices();
    const product = await resolveProductByCodeOrId(id, this._getProductPopulateOptions());
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
    const product = await resolveProductByCodeOrId(code, this._getProductPopulateOptions());
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

    const fullProduct = withColorStatuses({ ...product, certificateImage, inWishlist, sizeChart });
    return formatStorefrontProductDetail(fullProduct);
  }

  _getProductPopulateOptions() {
    return getProductPopulateOptions();
  }

  async _extractSizeChart(product) {
    return extractSizeChart(product);
  }

  _formatSizeChart(chart, categoryName = '') {
    return formatSizeChart(chart, categoryName);
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
      const catInputs = String(queryParams.category).split(',').map((s) => s.trim()).filter(Boolean);
      const validIds = catInputs.filter((id) => mongoose.isValidObjectId(id));
      const slugsOrNames = catInputs.filter((id) => !mongoose.isValidObjectId(id));

      let resolvedCategoryIds = [...validIds];
      if (slugsOrNames.length) {
        const catDocs = await Category.find({
          $or: [
            { slug: { $in: slugsOrNames.map((s) => s.toLowerCase()) } },
            { name: { $in: slugsOrNames.map((s) => new RegExp(`^${s}$`, 'i')) } },
          ],
          'meta.deletedAt': null,
        }).distinct('_id');
        resolvedCategoryIds = [...new Set([...resolvedCategoryIds, ...catDocs.map(String)])];
      }

      if (resolvedCategoryIds.length === 1) {
        filter.categoryIds = resolvedCategoryIds[0];
      } else if (resolvedCategoryIds.length > 1) {
        filter.categoryIds = { $in: resolvedCategoryIds };
      }
    }

    if (queryParams.menuItem) {
      if (!mongoose.isValidObjectId(queryParams.menuItem))
        throw new ApiError(400, 'Valid menuItem ID is required');
      filter.$and = [
        ...(filter.$and || []),
        { $or: [{ menuItemIds: queryParams.menuItem }] }
      ];
    }

    // Dynamic Filter: Featured showcase / campaign
    let featuredHandpickedIds = [];
    if (queryParams.featured) {
      let featDoc = null;
      if (mongoose.isValidObjectId(queryParams.featured)) {
        featDoc = await Featured.findOne({ _id: queryParams.featured, 'meta.deletedAt': null }).lean();
      }
      if (!featDoc) {
        featDoc = await Featured.findOne({
          name: new RegExp(`^${queryParams.featured}$`, 'i'),
          'meta.deletedAt': null,
        }).lean();
      }

      if (featDoc) {
        const featProductIds = (featDoc.productIds || []).map((id) => (id._id ? id._id.toString() : id.toString())).filter(Boolean);
        if (featProductIds.length > 0) {
          featuredHandpickedIds = featProductIds.filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id));
          if (featuredHandpickedIds.length > 0) {
            filter.$and = [
              ...(filter.$and || []),
              { _id: { $in: featuredHandpickedIds } },
            ];
          }
        } else if (featDoc.categoryId) {
          // If productIds is empty, display products of that category
          const catId = featDoc.categoryId._id ? featDoc.categoryId._id.toString() : featDoc.categoryId.toString();
          if (!queryParams.category) {
            filter.$and = [
              ...(filter.$and || []),
              { categoryIds: mongoose.Types.ObjectId.isValid(catId) ? new mongoose.Types.ObjectId(catId) : catId },
            ];
          }
        } else if (featDoc.menuItemIds?.length) {
          filter.$and = [
            ...(filter.$and || []),
            { menuItemIds: { $in: featDoc.menuItemIds } },
          ];
        }
      }
    }

    if (queryParams.productIds || queryParams.ids) {
      const explicitIds = String(queryParams.productIds || queryParams.ids).split(',').map((s) => s.trim()).filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id));
      if (explicitIds.length > 0) {
        featuredHandpickedIds = [...featuredHandpickedIds, ...explicitIds];
        filter.$and = [
          ...(filter.$and || []),
          { _id: { $in: explicitIds } },
        ];
      }
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
          ...(featuredHandpickedIds.length ? [{ _id: { $in: featuredHandpickedIds } }] : []),
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

    // Dynamic Filter: Diamond Type
    if (queryParams.diamondType) {
      const types = String(queryParams.diamondType).split(',').map((s) => s.trim()).filter(Boolean);
      if (types.length) {
        const dtDocs = await DiamondType.find({
          $or: [
            { _id: { $in: types.filter((t) => mongoose.isValidObjectId(t)) } },
            { name: { $in: types.map((t) => new RegExp(`^${t}$`, 'i')) } },
          ],
        }).distinct('_id');
        const typeIds = dtDocs.length ? dtDocs : types.filter((t) => mongoose.isValidObjectId(t));
        const regexList = types.map((t) => new RegExp(t, 'i'));

        filter.$and = [
          ...(filter.$and || []),
          {
            $or: [
              ...(typeIds.length ? [
                { 'centerDiamondRows.diamondTypeId': { $in: typeIds } },
                { 'sideDiamondRows.diamondTypeId': { $in: typeIds } },
                { 'variants.diamondTypeId': { $in: typeIds } },
              ] : []),
              { 'basicInfo.title': { $in: regexList } },
              { 'basicInfo.description': { $in: regexList } },
            ],
          },
        ];
      }
    }

    // Dynamic Filter: Diamond Clarity
    if (queryParams.clarity) {
      const clarities = String(queryParams.clarity).split(',').map((s) => s.trim()).filter(Boolean);
      if (clarities.length) {
        const dcDocs = await DiamondClarity.find({
          $or: [
            { _id: { $in: clarities.filter((c) => mongoose.isValidObjectId(c)) } },
            { name: { $in: clarities.map((c) => new RegExp(`^${c}$`, 'i')) } },
          ],
        }).distinct('_id');
        const clarityIds = dcDocs.length ? dcDocs : clarities.filter((c) => mongoose.isValidObjectId(c));
        const regexList = clarities.map((c) => new RegExp(c, 'i'));

        filter.$and = [
          ...(filter.$and || []),
          {
            $or: [
              ...(clarityIds.length ? [
                { 'centerDiamondRows.diamondClarityId': { $in: clarityIds } },
                { 'sideDiamondRows.diamondClarityId': { $in: clarityIds } },
                { 'variants.diamondClarityId': { $in: clarityIds } },
              ] : []),
              { 'basicInfo.title': { $in: regexList } },
              { 'basicInfo.description': { $in: regexList } },
            ],
          },
        ];
      }
    }

    // Dynamic Filter: Carat Weight
    if (queryParams.carat) {
      const carats = String(queryParams.carat).split(',').map((s) => s.trim()).filter(Boolean);
      if (carats.length) {
        const numericCarats = carats
          .map((c) => parseFloat(c.replace(/[^\d.]/g, '')))
          .filter((n) => !isNaN(n));
        const orBranches = [];
        if (numericCarats.length) {
          numericCarats.forEach((num) => {
            orBranches.push(
              { 'centerDiamondRows.caratWeight': { $gte: num - 0.25, $lte: num + 0.25 } },
              { 'variants.caratWeight': { $gte: num - 0.25, $lte: num + 0.25 } },
              { 'pricing.baseCarat': { $gte: num - 0.25, $lte: num + 0.25 } }
            );
          });
        }
        carats.forEach((c) => {
          orBranches.push({ 'basicInfo.title': new RegExp(c, 'i') });
        });
        if (orBranches.length) {
          filter.$and = [...(filter.$and || []), { $or: orBranches }];
        }
      }
    }

    // Dynamic Filter: Collections
    if (queryParams.collection) {
      const collectionVals = String(queryParams.collection).split(',').map((s) => s.trim()).filter(Boolean);
      if (collectionVals.length) {
        const featuredItems = await Featured.find({
          $or: [
            { _id: { $in: collectionVals.filter((v) => mongoose.isValidObjectId(v)) } },
            { name: { $in: collectionVals.map((v) => new RegExp(`^${v}$`, 'i')) } },
          ],
        }).select('productIds categoryId name').lean();

        const pIds = featuredItems.flatMap((f) => (f.productIds || []).map((id) => (id._id || id))).filter(Boolean);
        const catIds = featuredItems.map((f) => (f.categoryId?._id || f.categoryId)).filter(Boolean);
        const regexList = collectionVals.map((v) => new RegExp(v, 'i'));

        filter.$and = [
          ...(filter.$and || []),
          {
            $or: [
              ...(pIds.length ? [{ _id: { $in: pIds } }] : []),
              ...(pIds.length === 0 && catIds.length ? [{ categoryIds: { $in: catIds } }] : []),
              { 'ornate.groupName': { $in: regexList } },
              { 'ornate.customGroupName': { $in: regexList } },
              { 'basicInfo.title': { $in: regexList } },
            ],
          },
        ];
      }
    }

    // Dynamic Filter: Metal
    if (queryParams.metal) {
      const metals = String(queryParams.metal).split(',').map((s) => s.trim()).filter(Boolean);
      if (metals.length) {
        const orBranches = [];
        for (const m of metals) {
          const reg = new RegExp(m, 'i');
          if (/silver/i.test(m)) {
            orBranches.push({ productType: 'silver' });
            orBranches.push({ 'ornate.metalName': reg });
          } else if (/gold/i.test(m)) {
            orBranches.push({ productType: 'gold' });
            orBranches.push({ 'ornate.metalName': reg });
          } else if (/platinum/i.test(m)) {
            orBranches.push({ 'ornate.metalName': reg });
          }

          try {
            const MetalColorModel = mongoose.model('MetalColor');
            const matchingColors = await MetalColorModel.find({ name: reg }).distinct('_id');
            if (matchingColors.length) {
              orBranches.push({ metalColorIds: { $in: matchingColors } });
              orBranches.push({ 'variants.metalColorId': { $in: matchingColors } });
              orBranches.push({ 'colorImages.metalColorId': { $in: matchingColors } });
            }
          } catch (_) {}
          orBranches.push({ 'basicInfo.title': reg });
        }
        if (orBranches.length) {
          filter.$and = [...(filter.$and || []), { $or: orBranches }];
        }
      }
    }

    // Dynamic Filter: Availability / Stock
    const stockParam = queryParams.stockStatus || queryParams.availability;
    if (stockParam) {
      const statuses = String(stockParam).split(',').map((s) => s.trim()).filter(Boolean);
      if (statuses.length) {
        const orBranches = [
          { stockStatus: { $in: statuses } },
        ];
        if (statuses.includes('In Stock')) {
          orBranches.push({ 'ornate.isSold': false, 'ornate.stockQty': { $gt: 0 } });
        }
        if (statuses.includes('Out of Stock')) {
          orBranches.push({ $or: [{ 'ornate.isSold': true }, { 'ornate.stockQty': { $lte: 0 } }] });
        }
        filter.$and = [...(filter.$and || []), { $or: orBranches }];
      }
    }
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
      const catInputs = String(queryParams.category).split(',').map((s) => s.trim()).filter(Boolean);
      const validIds = catInputs.filter((id) => mongoose.isValidObjectId(id));
      const slugsOrNames = catInputs.filter((id) => !mongoose.isValidObjectId(id));

      let resolvedCategoryIds = [...validIds];
      if (slugsOrNames.length) {
        const catDocs = await Category.find({
          $or: [
            { slug: { $in: slugsOrNames.map((s) => s.toLowerCase()) } },
            { name: { $in: slugsOrNames.map((s) => new RegExp(`^${s}$`, 'i')) } },
          ],
          'meta.deletedAt': null,
        }).distinct('_id');
        resolvedCategoryIds = [...new Set([...resolvedCategoryIds, ...catDocs.map(String)])];
      }

      if (resolvedCategoryIds.length === 1) {
        filter.categoryIds = resolvedCategoryIds[0];
      } else if (resolvedCategoryIds.length > 1) {
        filter.categoryIds = { $in: resolvedCategoryIds };
      }
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
  async update(id, data, userId) {
    const actorId = userId || getRequestContext('userId');
    // Product update API does not change the status field
    delete data.status;

    if (actorId) {
      data['meta.updatedBy'] = actorId;
      data['meta.updatedAt'] = new Date();
    }

    const existing = await Product.findById(id).lean();
    if (!existing) throw new ApiError(404, 'Product not found');

    // Preserve existing demoMetrics when updating other product info
    if (data.demoMetrics) {
      const existingDemo = existing.demoMetrics || {};
      const newSold = data.demoMetrics.soldCount;
      const newReview = data.demoMetrics.reviewCount;
      const parsedSold = Number(newSold);
      const parsedReview = Number(newReview);

      data.demoMetrics = {
        soldCount: (!isNaN(parsedSold) && parsedSold > 0)
          ? parsedSold
          : (existingDemo.soldCount ?? (parsedSold || 0)),
        reviewCount: (!isNaN(parsedReview) && parsedReview > 0)
          ? parsedReview
          : (existingDemo.reviewCount ?? (parsedReview || 0)),
      };
    } else if (existing.demoMetrics) {
      data.demoMetrics = existing.demoMetrics;
    }
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
        ...(calculated.variants ? { variants: calculated.variants } : {}),
        ...(calculated.pricing ? { pricing: calculated.pricing } : {})
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
      // Only regenerate slug if the product has no slug yet, or if title/barcode actually changed
      const existingSlug = existing.basicInfo?.slug;
      const titleChanged = data.basicInfo?.title && data.basicInfo.title !== existing.basicInfo?.title;
      const barcodeChanged = (data.ornate?.barcode ?? data.barcode) &&
        (data.ornate?.barcode ?? data.barcode) !== (existing.ornate?.barcode ?? existing.barcode);
      const needsSlug = !existingSlug || titleChanged || barcodeChanged;
      if (title && needsSlug) {
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

    // Preserve existing slug when basicInfo is updated without an explicit slug, or generate from title
    if (data.basicInfo && !data.basicInfo.slug) {
      if (existing.basicInfo?.slug) {
        data.basicInfo.slug = existing.basicInfo.slug;
      } else {
        const titleForSlug = data.basicInfo.title || existing.basicInfo?.title;
        if (titleForSlug) {
          data.basicInfo.slug = titleForSlug
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
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

  // ------------------------------- update product status ----------------------------
  async updateStatus(id, status, userId) {
    const actorId = userId || getRequestContext('userId');
    const validStatus = status === 'approved' || status === 'published' ? 'approved' : 'draft';
    const updatePayload = { status: validStatus, 'meta.updatedAt': new Date() };
    if (actorId) {
      updatePayload['meta.updatedBy'] = actorId;
    }
    const product = await Product.findOneAndUpdate(
      { _id: id },
      { $set: updatePayload },
      { returnDocument: 'after' }
    );

    if (!product) {
      throw new ApiError(404, 'Product not found');
    }

    try {
      await productGroupService.refreshAffectedGroups(product._id);
    } catch (err) {
      console.error(`Error refreshing groups after status update (${id}):`, err);
    }

    return product;
  }

  // ------------------------------- delete product ----------------------------
  async delete(id, userId) {
    const actorId = userId || getRequestContext('userId');
    const updatePayload = { status: 'draft', 'meta.deletedAt': new Date(), 'meta.updatedAt': new Date() };
    if (actorId) {
      updatePayload['meta.deletedBy'] = actorId;
      updatePayload['meta.updatedBy'] = actorId;
    }
    const product = await Product.findOneAndUpdate(
      { _id: id },
      { $set: updatePayload },
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
}

module.exports = new ProductService();
