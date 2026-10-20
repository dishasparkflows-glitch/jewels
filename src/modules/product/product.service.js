const mongoose = require('mongoose');
const Product = require('./product.model');
const { SHOP_FOR_OPTIONS, getShopForGenders } = require('./product.filters');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

// Lean and aggregate results do not apply schema defaults to existing records.
const withColorStatuses = (product) => {
  if (Array.isArray(product.colorImages)) {
    product.colorImages = product.colorImages.map((color) => ({
      ...color,
      status: color.status ?? 'active',
    }));
  }
  return product;
};

class ProductService {
  // ------------------------------- create product ----------------------------
  async create(data) {
    if (Array.isArray(data.colorImages)) {
      data.colorImages = data.colorImages.map((ci) => {
        const item = { ...ci };
        if (!item.metalColorId || !mongoose.isValidObjectId(item.metalColorId)) {
          delete item.metalColorId;
        }
        return item;
      });
    }
    if (data.basicInfo?.sku) {
      const existingSku = await Product.findOne({ 'basicInfo.sku': data.basicInfo.sku });
      if (existingSku) {
        throw new ApiError(409, `Product with SKU/Tag "${data.basicInfo.sku}" already exists`);
      }
    }

    return await Product.create(data);
  }

  // ------------------------------- get one product ----------------------------
  async getOne(id) {
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const filter = isObjectId
      ? { $or: [{ _id: id }, { 'basicInfo.slug': id }, { 'basicInfo.sku': id }, { 'ornate.tagNo': id }] }
      : { $or: [{ 'basicInfo.slug': id }, { 'basicInfo.sku': id }, { 'ornate.tagNo': id }] };

    let product = await Product.findOne(filter)
      .populate({ path: 'categoryIds', select: 'name slug sizeChart', strictPopulate: false })
      .populate({ path: 'metalColorIds', select: 'name code hex', strictPopulate: false })
      .populate({ path: 'metalPurityIds', select: 'name karat metalType', strictPopulate: false })
      .populate({ path: 'colorImages.metalColorId', select: 'name code hex', strictPopulate: false })
      .populate({ path: 'variants.metalPurityId', select: 'name karat metalType', strictPopulate: false })
      .populate({ path: 'variants.diamondTypeId', select: 'name', strictPopulate: false })
      .populate({ path: 'variants.diamondShapeId', select: 'name', strictPopulate: false })
      .populate({ path: 'variants.diamondColorId', select: 'name', strictPopulate: false })
      .populate({ path: 'variants.diamondClarityId', select: 'name', strictPopulate: false })
      .lean();

    if (!product) {
      throw new ApiError(404, 'Product not found');
    }

    return withColorStatuses(product);
  }

  // ------------------------------- get product by sku or tag ----------------------------
  async getBySkuOrTag(code) {
    const product = await Product.findOne({
      $or: [{ 'basicInfo.sku': code }, { 'ornate.tagNo': code }],
    }).lean();
    if (!product) {
      throw new ApiError(404, `Product with SKU/Tag "${code}" not found`);
    }
    return withColorStatuses(product);
  }

  // ------------------------------- get all products ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    if (queryParams.search) {
      const searchRegex = new RegExp(queryParams.search, 'i');
      filter.$or = [
        { 'basicInfo.title': searchRegex },
        { 'basicInfo.sku': searchRegex },
        { 'ornate.tagNo': searchRegex },
        { 'ornate.barcode': searchRegex },
        { 'ornate.itemCode': searchRegex },
        { 'ornate.groupName': searchRegex },
        { 'ornate.customGroupName': searchRegex },
      ];
    }

    if (queryParams.productType) {
      const pt = String(queryParams.productType).toLowerCase();
      let typeMatcher;
      if (pt === 'jewelry' || pt === 'gold') {
        typeMatcher = { $in: ['gold', 'jewelry', 'Gold', 'Jewelry'] };
      } else if (pt === 'silver' || pt === 'standard') {
        typeMatcher = { $in: ['silver', 'standard', 'Silver', 'Standard'] };
      } else {
        typeMatcher = queryParams.productType;
      }
      filter.$and = [
        ...(filter.$and || []),
        { $or: [{ 'basicInfo.productType': typeMatcher }, { productType: typeMatcher }] },
      ];
    }

    if (queryParams.isOrnate !== undefined) {
      const isO = queryParams.isOrnate === 'true' || queryParams.isOrnate === true;
      filter.$and = [
        ...(filter.$and || []),
        { $or: [{ 'basicInfo.isOrnate': isO }, { isOrnate: isO }] },
      ];
    }

    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    if (queryParams.category) {
      filter.categoryIds = queryParams.category;
    }

    if (queryParams.menuItem) {
      if (!mongoose.isValidObjectId(queryParams.menuItem)) throw new ApiError(400, 'Valid menuItem ID is required');
      filter.$and = [...(filter.$and || []), { $or: [
        { menuItemIds: queryParams.menuItem },
      ] }];
    }

    // Match the positive price precedence used by storefront product cards.
    const effectivePrice = ['pricing.salePrice', 'pricing.mrp']
      .reduceRight((fallback, field) => ({ $cond: [{ $gt: [`$${field}`, 0] }, `$${field}`, fallback] }), null);
    const priceConditions = [];
    for (const [parameter, operator] of [['minPrice', '$gte'], ['maxPrice', '$lte']]) {
      if (queryParams[parameter] !== undefined && queryParams[parameter] !== '') {
        const value = Number(queryParams[parameter]);
        if (!Number.isFinite(value) || value < 0) throw new ApiError(400, 'Price must be a non-negative number');
        priceConditions.push({ [operator]: [effectivePrice, value] });
      }
    }
    if (priceConditions.length) filter.$expr = { $and: [{ $ne: [effectivePrice, null] }, ...priceConditions] };
    if (queryParams.minPrice && queryParams.maxPrice && Number(queryParams.minPrice) > Number(queryParams.maxPrice)) {
      throw new ApiError(400, 'Maximum price must be greater than minimum price');
    }
    // Facet counts respect all other filters, but not the current audience selection.
    const facetFilter = { ...filter };
    const genders = getShopForGenders(queryParams.shopFor);
    if (genders.length) filter['basicInfo.gender'] = { $in: genders };
    const facetsQuery = queryParams.includeFacets === 'true'
      ? Promise.all(SHOP_FOR_OPTIONS.map(async (option) => ({
        value: option.value, label: option.label,
        count: await Product.countDocuments({ ...facetFilter, 'basicInfo.gender': { $in: option.genders } }),
      })))
      : Promise.resolve(undefined);
    const colorPopulation = { path: 'metalColorIds colorImages.metalColorId', select: 'name code hex' };
    const priceSort = { 'price-low': 1, 'price-high': -1 }[queryParams.sort];
    const itemQuery = priceSort
      ? Product.aggregate([
        { $match: Product.find(filter).cast(Product) },
        { $set: { cataloguePrice: effectivePrice, cataloguePriceMissing: { $cond: [{ $eq: [effectivePrice, null] }, 1, 0] } } },
        { $sort: { cataloguePriceMissing: 1, cataloguePrice: priceSort, _id: -1 } },
        { $skip: skip }, { $limit: limit },
        { $unset: ['cataloguePrice', 'cataloguePriceMissing'] },
      ]).then((products) => Product.populate(products, colorPopulation))
      : Product.find(filter).populate(colorPopulation).sort({ 'meta.createdAt': -1, _id: -1 }).skip(skip).limit(limit).lean();
    const [items, total, shopFor] = await Promise.all([itemQuery, Product.countDocuments(filter), facetsQuery]);

    return { items: items.map(withColorStatuses), pagination: getPaginationMeta(total, page, limit), facets: shopFor ? { shopFor } : undefined };
  }

  // Helper to format concise product card info for the home page
  _formatHomeProduct(p) {
    if (!p) return null;
    withColorStatuses(p);
    const salePrice = Number(p.pricing?.salePrice || 0);
    const mrp = Number(p.pricing?.mrp || 0);
    const price = salePrice > 0 ? salePrice : (mrp > 0 ? mrp : null);

    // Extract primary image
    let image = '';
    const images = [];

    if (Array.isArray(p.colorImages)) {
      p.colorImages.forEach((c) => {
        if (Array.isArray(c.images)) {
          c.images.forEach((img) => {
            const u = typeof img === 'string' ? img : img?.url;
            if (u && !u.toLowerCase().includes('ornate')) images.push(u);
          });
        }
      });
    }

    if (images.length > 0) {
      image = images[0];
    } else {
      image = '';
    }

    return {
      _id: p._id,
      id: p._id,
      basicInfo: p.basicInfo || {},
      pricing: p.pricing || {},
      cataloguePrice: price,
      image,
      colorImages: p.colorImages || [],
      metalColors: p.metalColorIds || [],
      metalColorIds: p.metalColorIds || [],
      category: p.categoryIds || [],
      productType: p.basicInfo?.productType || '',
      isOrnate: Boolean(p.basicInfo?.isOrnate),
      stockStatus: p.stockStatus || '',
    };
  }

  // ------------------------------- get home products (streamlined info) ----------------------------
  async getHomeProducts(queryParams = {}) {
    const limit = Math.min(Number(queryParams.limit) || 24, 50);
    const filter = { 'meta.deletedAt': null, status: 'active' };

    if (queryParams.category) {
      filter.categoryIds = queryParams.category;
    }
    if (queryParams.metalName) {
      filter.$or = [
        { 'ornate.metalName': new RegExp(queryParams.metalName, 'i') },
        { 'basicInfo.productType': new RegExp(queryParams.metalName, 'i') },
      ];
    }

    // Select ONLY needed fields from mongo to keep query ultra fast (no ornateImages for storefront)
    const selectFields =
      '_id colorImages metalColorIds stockStatus categoryIds basicInfo pricing ornate';

    const items = await Product.find(filter)
      .select(selectFields)
      .populate('metalColorIds colorImages.metalColorId', 'name code hex')
      .sort({ 'meta.createdAt': -1, _id: -1 })
      .limit(limit)
      .lean();

    const formatted = items.map((p) => this._formatHomeProduct(p));

    // Curate sections for the home page storefront
    const platinum = formatted.filter((p) => !p.isOrnate).slice(0, 5);
    const silver = formatted
      .filter((p) => p.basicInfo?.isOrnate || p.ornate?.metalName?.toUpperCase() === 'SILVER')
      .slice(0, 5);
    const trending = formatted.slice(0, 5);

    return {
      items: formatted,
      sections: {
        platinum: platinum.length > 0 ? platinum : formatted.slice(0, 5),
        silver: silver.length > 0 ? silver : formatted.slice(5, 10),
        trending: trending.length > 0 ? trending : formatted.slice(0, 5),
      },
      total: formatted.length,
    };
  }

  // ------------------------------- get product lookup ----------------------------
  async getLookup(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const conditions = [{ 'meta.deletedAt': null }];

    if (queryParams.status && queryParams.status !== 'all') {
      conditions.push({ status: queryParams.status });
    } else if (!queryParams.status) {
      conditions.push({ status: 'active' });
    }

    if (queryParams.productType && queryParams.productType !== 'all') {
      const pt = String(queryParams.productType).toLowerCase();
      if (pt === 'gold' || pt === 'jewelry') {
        conditions.push({
          $and: [
            {
              $or: [
                { 'basicInfo.productType': { $in: ['gold', 'jewelry', 'Gold', 'Jewelry'] } },
                { 'ornate.metalName': new RegExp('gold', 'i') },
                { 'basicInfo.title': new RegExp('gold', 'i') },
              ],
            },
            { 'basicInfo.isOrnate': { $ne: true } },
          ],
        });
      } else if (pt === 'silver' || pt === 'standard') {
        conditions.push({
          $or: [
            { 'basicInfo.productType': { $in: ['silver', 'Silver', 'standard', 'Standard'] } },
            { 'basicInfo.productType': { $in: ['silver', 'Silver', 'standard', 'Standard'] } },
            { 'ornate.metalName': new RegExp('silver', 'i') },
            { 'basicInfo.title': new RegExp('silver|925', 'i') },
          ],
        });
      } else if (pt === 'ornate') {
        conditions.push({
          $or: [{ 'basicInfo.isOrnate': true }, { 'basicInfo.productType': 'ornate' }],
        });
      } else {
        conditions.push({
          'basicInfo.productType': queryParams.productType,
        });
      }
    }

    if (queryParams.isOrnate !== undefined) {
      const isO = queryParams.isOrnate === 'true' || queryParams.isOrnate === true;
      conditions.push({
        'basicInfo.isOrnate': isO,
      });
    }

    if (queryParams.category) {
      conditions.push({ categoryIds: queryParams.category });
    }

    if (queryParams.search) {
      const searchRegex = new RegExp(queryParams.search, 'i');
      conditions.push({
        $or: [
          { 'basicInfo.title': searchRegex },
          { 'basicInfo.sku': searchRegex },
          { 'ornate.tagNo': searchRegex },
          { 'ornate.barcode': searchRegex },
          { 'ornate.itemCode': searchRegex },
          { 'ornate.groupName': searchRegex },
        ],
      });
    }

    const filter = conditions.length === 1 ? conditions[0] : { $and: conditions };

    const [rawItems, total] = await Promise.all([
      Product.find(filter)
        .select('_id basicInfo categoryIds colorImages ornate pricing productType isOrnate specifications status')
        .populate({ path: 'categoryIds', select: 'name slug', strictPopulate: false })
        .sort({ 'meta.createdAt': -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    const items = rawItems.map((p) => {
      withColorStatuses(p);
      const derivedImages = (p.colorImages || []).flatMap((color) => color.images || []);
      const thumb =
        derivedImages?.[0]?.url ||
        p.ornate?.ornateImages?.[0]?.url ||
        '';

      const effectivePrice = Number(p.pricing?.salePrice || p.pricing?.mrp || 0);

      const resolvedCategory =
        (Array.isArray(p.categoryIds) && p.categoryIds.length > 0) ? p.categoryIds :
        [];

      return {
        _id: p._id,
        id: p._id,
        basicInfo: p.basicInfo || {},
        pricing: p.pricing || {},
        ornate: p.ornate || {},
        category: resolvedCategory,
        productType: p.basicInfo?.productType,
        isOrnate: Boolean(p.basicInfo?.isOrnate),
        cataloguePrice: effectivePrice,
        status: p.status,
        colorImages: p.colorImages || [],
        thumbnail: thumb,
      };
    });

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- update product ----------------------------
  async update(id, data) {
    if (Array.isArray(data.colorImages)) {
      data.colorImages = data.colorImages.map((ci) => {
        const item = { ...ci };
        if (!item.metalColorId || !mongoose.isValidObjectId(item.metalColorId)) {
          delete item.metalColorId;
        }
        return item;
      });
    }
    if (data.basicInfo?.sku) {
      const duplicate = await Product.findOne({
        'basicInfo.sku': data.basicInfo.sku,
        _id: { $ne: id },
      });
      if (duplicate) {
        throw new ApiError(409, `Product with SKU "${data.basicInfo.sku}" already exists`);
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
