const mongoose = require('mongoose');
const Product = require('./product.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class ProductService {
  // ------------------------------- create product ----------------------------
  async create(data) {
    // Sync structured blocks into root fields if provided
    if (data.basicInfo) {
      if (data.basicInfo.title && !data.title) data.title = data.basicInfo.title;
      if (data.basicInfo.sku && !data.sku) data.sku = data.basicInfo.sku;
      if (data.basicInfo.slug && !data.slug) data.slug = data.basicInfo.slug;
      if (data.basicInfo.description && !data.description) data.description = data.basicInfo.description;
      if (data.basicInfo.productType) data.productType = data.basicInfo.productType;
      if (data.basicInfo.isOrnate !== undefined) data.isOrnate = Boolean(data.basicInfo.isOrnate);
    }
    if (data.pricing) {
      if (data.pricing.mrp !== undefined && !data.mrp) data.mrp = data.pricing.mrp;
      if (data.pricing.mrp !== undefined && !data.price) data.price = data.pricing.mrp;
      if (data.pricing.salePrice !== undefined && !data.salePrice) data.salePrice = data.pricing.salePrice;
      if (data.pricing.costPrice !== undefined && !data.costPrice) data.costPrice = data.pricing.costPrice;
      if (data.pricing.displayPrice !== undefined && !data.displayPrice) data.displayPrice = data.pricing.displayPrice;
      if (data.pricing.gstPercentage !== undefined && !data.gstPercentage) data.gstPercentage = data.pricing.gstPercentage;
      if (data.pricing.markupPercentage !== undefined && !data.markupPercentage) data.markupPercentage = data.pricing.markupPercentage;
    }
    if (data.specifications?.metalWeight !== undefined && !data.baseMetalWeight) {
      data.baseMetalWeight = data.specifications.metalWeight;
    }
    if (data.ornate) {
      if (data.ornate.tagNo && !data.tagNo) data.tagNo = data.ornate.tagNo;
      if (data.ornate.barcode && !data.barcodeNo) data.barcodeNo = data.ornate.barcode;
      if (data.ornate.itemCode && !data.itemCode) data.itemCode = data.ornate.itemCode;
      if (data.ornate.goldAmt !== undefined && !data.goldAmt) data.goldAmt = data.ornate.goldAmt;
      if (data.ornate.labourAmt !== undefined && !data.labourAmt) data.labourAmt = data.ornate.labourAmt;
      if (data.ornate.diamondAmt !== undefined && !data.diamondAmt) data.diamondAmt = data.ornate.diamondAmt;
      if (data.ornate.stockQty !== undefined && !data.stockQty) data.stockQty = data.ornate.stockQty;
      if (data.ornate.isSold !== undefined && data.isSold === undefined) data.isSold = data.ornate.isSold;
    }

    if (data.productType === 'ornate' || data.isOrnate || (data.tagNo && data.tagNo.trim() !== '')) {
      data.isOrnate = true;
      data.productType = 'ornate';
      if (!data.sku && data.tagNo) data.sku = data.tagNo;
    }

    const existingSku = await Product.findOne({ sku: data.sku });
    if (existingSku) {
      throw new ApiError(409, `Product with SKU/Tag "${data.sku}" already exists`);
    }

    return await Product.create(data);
  }

  // ------------------------------- get one product ----------------------------
  async getOne(id) {
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const filter = isObjectId
      ? { $or: [{ _id: id }, { slug: id }, { sku: id }] }
      : { $or: [{ slug: id }, { sku: id }] };

    let product = await Product.findOne(filter)
      .populate('category', 'name slug sizeChart')
      .populate('metalColors', 'name code hex')
      .populate('colorImages.metalColor', 'name code hex')
      .populate('variants.metalPurity', 'name karat metalType')
      .populate('variants.diamondType', 'name')
      .populate('variants.diamondShape', 'name')
      .populate('variants.diamondColor', 'name')
      .populate('variants.diamondClarity', 'name')
      .lean();

    if (!product) {
      throw new ApiError(404, 'Product not found');
    }

    if (product.ornateImages) {
      delete product.ornateImages;
    }
    if (Array.isArray(product.images)) {
      product.images = product.images.filter((img) => {
        const url = typeof img === 'string' ? img : (img?.url || '');
        return !url.toLowerCase().includes('ornate');
      });
    }
    return product;
  }

  // ------------------------------- get product by sku or tag ----------------------------
  async getBySkuOrTag(code) {
    const product = await Product.findOne({
      $or: [{ sku: code }, { tagNo: code }],
    }).lean();
    if (!product) {
      throw new ApiError(404, `Product with SKU/Tag "${code}" not found`);
    }
    if (product.ornateImages) {
      delete product.ornateImages;
    }
    if (Array.isArray(product.images)) {
      product.images = product.images.filter((img) => {
        const url = typeof img === 'string' ? img : (img?.url || '');
        return !url.toLowerCase().includes('ornate');
      });
    }
    return product;
  }

  // ------------------------------- get all products ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    if (queryParams.search) {
      const searchRegex = new RegExp(queryParams.search, 'i');
      filter.$or = [
        { title: searchRegex },
        { sku: searchRegex },
        { tagNo: searchRegex },
        { barcodeNo: searchRegex },
        { uniqueLabelID: searchRegex },
        { groupName: searchRegex },
        { itemName: searchRegex },
      ];
    }

    if (queryParams.productType) {
      const pt = String(queryParams.productType).toLowerCase();
      if (pt === 'jewelry' || pt === 'gold') {
        filter.productType = { $in: ['gold', 'jewelry', 'Gold', 'Jewelry'] };
      } else if (pt === 'silver' || pt === 'standard') {
        filter.productType = { $in: ['silver', 'standard', 'Silver', 'Standard'] };
      } else {
        filter.productType = queryParams.productType;
      }
    }

    if (queryParams.isOrnate !== undefined) {
      filter.isOrnate = queryParams.isOrnate === 'true' || queryParams.isOrnate === true;
    }

    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    if (queryParams.category) {
      filter.category = queryParams.category;
    }

    if (queryParams.minPrice || queryParams.maxPrice) {
      filter.price = {};
      if (queryParams.minPrice) filter.price.$gte = Number(queryParams.minPrice);
      if (queryParams.maxPrice) filter.price.$lte = Number(queryParams.maxPrice);
    }

    const [items, total] = await Promise.all([
      Product.find(filter)
        .sort({ 'meta.createdAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // Helper to format concise product card info for the home page
  _formatHomeProduct(p) {
    if (!p) return null;
    const title = p.basicInfo?.title || p.title || p.itemName || '';
    const sku = p.basicInfo?.sku || p.sku || p.tagNo || '';
    const slug = p.basicInfo?.slug || p.slug || '';

    const salePrice = Number(p.salePrice || p.pricing?.salePrice || p.displayPrice || p.price || 0);
    const mrp = Number(p.mrp || p.pricing?.mrp || 0);
    const price = salePrice > 0 ? salePrice : (mrp > 0 ? mrp : null);

    // Extract primary image
    let image = '';
    const images = [];

    if (Array.isArray(p.images) && p.images.length > 0) {
      p.images.forEach((img) => {
        const u = typeof img === 'string' ? img : img?.url;
        if (u && !u.toLowerCase().includes('ornate')) images.push(u);
      });
    }
    if (images.length === 0 && Array.isArray(p.colorImages)) {
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
      title,
      sku,
      slug,
      price,
      salePrice: salePrice > 0 ? salePrice : (mrp > 0 ? mrp : null),
      mrp: mrp > 0 ? mrp : null,
      image,
      images,
      metalName: p.metalName || '',
      category: p.category || [],
      productType: p.productType || '',
      isOrnate: Boolean(p.isOrnate),
      inStock: p.inStock ?? p.stockQty,
      stockStatus: p.stockStatus || '',
    };
  }

  // ------------------------------- get home products (streamlined info) ----------------------------
  async getHomeProducts(queryParams = {}) {
    const limit = Math.min(Number(queryParams.limit) || 24, 50);
    const filter = { 'meta.deletedAt': null, status: 'active' };

    if (queryParams.category) {
      filter.category = queryParams.category;
    }
    if (queryParams.metalName) {
      filter.metalName = new RegExp(queryParams.metalName, 'i');
    }

    // Select ONLY needed fields from mongo to keep query ultra fast (no ornateImages for storefront)
    const selectFields =
      '_id title sku slug price salePrice mrp displayPrice images colorImages metalName stockQty stockStatus inStock category productType isOrnate basicInfo pricing';

    const items = await Product.find(filter)
      .select(selectFields)
      .sort({ 'meta.createdAt': -1, _id: -1 })
      .limit(limit)
      .lean();

    const formatted = items.map((p) => this._formatHomeProduct(p));

    // Curate sections for the home page storefront
    const platinum = formatted.filter((p) => !p.isOrnate).slice(0, 5);
    const silver = formatted
      .filter((p) => p.isOrnate || p.metalName?.toUpperCase() === 'SILVER')
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
                { productType: { $in: ['gold', 'jewelry', 'Gold', 'Jewelry'] } },
                { 'specifications.metalName': new RegExp('gold', 'i') },
                { metalName: new RegExp('gold', 'i') },
                { title: new RegExp('gold', 'i') },
              ],
            },
            { isOrnate: { $ne: true } },
          ],
        });
      } else if (pt === 'silver' || pt === 'standard') {
        conditions.push({
          $or: [
            { productType: { $in: ['silver', 'Silver', 'standard', 'Standard'] } },
            { 'specifications.metalName': new RegExp('silver', 'i') },
            { metalName: new RegExp('silver', 'i') },
            { title: new RegExp('silver|925', 'i') },
          ],
        });
      } else if (pt === 'ornate') {
        conditions.push({
          $or: [{ isOrnate: true }, { productType: 'ornate' }],
        });
      } else {
        conditions.push({ productType: queryParams.productType });
      }
    }

    if (queryParams.isOrnate !== undefined) {
      const isO = queryParams.isOrnate === 'true' || queryParams.isOrnate === true;
      conditions.push({ isOrnate: isO });
    }

    if (queryParams.category) {
      conditions.push({ category: queryParams.category });
    }

    if (queryParams.search) {
      const searchRegex = new RegExp(queryParams.search, 'i');
      conditions.push({
        $or: [
          { title: searchRegex },
          { sku: searchRegex },
          { tagNo: searchRegex },
          { barcodeNo: searchRegex },
          { itemName: searchRegex },
        ],
      });
    }

    const filter = conditions.length === 1 ? conditions[0] : { $and: conditions };

    const [rawItems, total] = await Promise.all([
      Product.find(filter)
        .select('_id title category images colorImages sku tagNo price salePrice mrp displayPrice productType isOrnate specifications metalName status')
        .populate('category', 'name slug')
        .sort({ 'meta.createdAt': -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    const items = rawItems.map((p) => {
      const thumb =
        p.images?.[0]?.url ||
        (typeof p.images?.[0] === 'string' ? p.images[0] : '') ||
        p.colorImages?.[0]?.images?.[0]?.url ||
        '';

      const effectivePrice = Number(p.salePrice || p.displayPrice || p.price || p.pricing?.salePrice || p.mrp || 0);

      return {
        _id: p._id,
        id: p._id,
        title: p.title || p.basicInfo?.title || '',
        sku: p.sku || p.tagNo || p.basicInfo?.sku || '',
        tagNo: p.tagNo || '',
        category: p.category || [],
        price: effectivePrice,
        salePrice: p.salePrice || p.displayPrice || p.price || 0,
        mrp: p.mrp || 0,
        productType: p.productType,
        isOrnate: Boolean(p.isOrnate),
        metalName: p.metalName || '',
        status: p.status,
        images: p.images || [],
        colorImages: p.colorImages || [],
        thumbnail: thumb,
      };
    });

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- update product ----------------------------
  async update(id, data) {
    if (data.basicInfo) {
      if (data.basicInfo.title) data.title = data.basicInfo.title;
      if (data.basicInfo.sku) data.sku = data.basicInfo.sku;
      if (data.basicInfo.slug) data.slug = data.basicInfo.slug;
      if (data.basicInfo.description) data.description = data.basicInfo.description;
      if (data.basicInfo.productType) data.productType = data.basicInfo.productType;
      if (data.basicInfo.isOrnate !== undefined) data.isOrnate = Boolean(data.basicInfo.isOrnate);
    }
    if (data.pricing) {
      if (data.pricing.mrp !== undefined) data.mrp = data.pricing.mrp;
      if (data.pricing.mrp !== undefined) data.price = data.pricing.mrp;
      if (data.pricing.salePrice !== undefined) data.salePrice = data.pricing.salePrice;
      if (data.pricing.costPrice !== undefined) data.costPrice = data.pricing.costPrice;
      if (data.pricing.displayPrice !== undefined) data.displayPrice = data.pricing.displayPrice;
      if (data.pricing.gstPercentage !== undefined) data.gstPercentage = data.pricing.gstPercentage;
      if (data.pricing.markupPercentage !== undefined) data.markupPercentage = data.pricing.markupPercentage;
    }
    if (data.specifications?.metalWeight !== undefined) {
      data.baseMetalWeight = data.specifications.metalWeight;
    }
    if (data.ornate) {
      if (data.ornate.tagNo) data.tagNo = data.ornate.tagNo;
      if (data.ornate.barcode) data.barcodeNo = data.ornate.barcode;
      if (data.ornate.itemCode) data.itemCode = data.ornate.itemCode;
      if (data.ornate.goldAmt !== undefined) data.goldAmt = data.ornate.goldAmt;
      if (data.ornate.labourAmt !== undefined) data.labourAmt = data.ornate.labourAmt;
      if (data.ornate.diamondAmt !== undefined) data.diamondAmt = data.ornate.diamondAmt;
      if (data.ornate.stockQty !== undefined) data.stockQty = data.ornate.stockQty;
      if (data.ornate.isSold !== undefined) data.isSold = data.ornate.isSold;
    }

    if (data.sku) {
      const duplicate = await Product.findOne({
        sku: data.sku,
        _id: { $ne: id },
      });
      if (duplicate) {
        throw new ApiError(409, `Product with SKU "${data.sku}" already exists`);
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
