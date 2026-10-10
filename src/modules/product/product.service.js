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
    if (data.specifications) {
      if (data.specifications.metalName && !data.metalName) data.metalName = data.specifications.metalName;
      if (data.specifications.metalWeight !== undefined && !data.baseMetalWeight) data.baseMetalWeight = data.specifications.metalWeight;
      if (data.specifications.metalPurity !== undefined && !data.purity) data.purity = data.specifications.metalPurity;
      if (data.specifications.grossWeight !== undefined && !data.grossWt) data.grossWt = data.specifications.grossWeight;
      if (data.specifications.netWeight !== undefined && !data.netWt) data.netWt = data.specifications.netWeight;
      if (data.specifications.stoneWeight !== undefined && !data.stoneWt) data.stoneWt = data.specifications.stoneWeight;
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

    const existingSku = await Product.findOne({ sku: data.sku, isDeleted: false });
    if (existingSku) {
      throw new ApiError(409, `Product with SKU/Tag "${data.sku}" already exists`);
    }

    return await Product.create(data);
  }

  // ------------------------------- get one product ----------------------------
  async getOne(id) {
    const product = await Product.findOne({ _id: id, isDeleted: false });
    if (!product) {
      throw new ApiError(404, 'Product not found');
    }
    return product;
  }

  // ------------------------------- get product by sku or tag ----------------------------
  async getBySkuOrTag(code) {
    const product = await Product.findOne({
      $or: [{ sku: code }, { tagNo: code }],
      isDeleted: false,
    });
    if (!product) {
      throw new ApiError(404, `Product with SKU/Tag "${code}" not found`);
    }
    return product;
  }

  // ------------------------------- get all products ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { isDeleted: false };

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
      filter.productType = queryParams.productType;
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

  // ------------------------------- get product lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { isDeleted: false };

    if (queryParams.productType) {
      filter.productType = queryParams.productType;
    }
    if (queryParams.isOrnate !== undefined) {
      filter.isOrnate = queryParams.isOrnate === 'true' || queryParams.isOrnate === true;
    }
    if (queryParams.status) {
      filter.status = queryParams.status;
    } else {
      filter.status = 'active';
    }

    if (queryParams.search) {
      const searchRegex = new RegExp(queryParams.search, 'i');
      filter.$or = [
        { title: searchRegex },
        { sku: searchRegex },
        { tagNo: searchRegex },
      ];
    }

    return await Product.find(filter)
      .select('_id title sku tagNo price salePrice productType isOrnate images')
      .limit(queryParams.limit ? Number(queryParams.limit) : 100)
      .lean();
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
    if (data.specifications) {
      if (data.specifications.metalName) data.metalName = data.specifications.metalName;
      if (data.specifications.metalWeight !== undefined) data.baseMetalWeight = data.specifications.metalWeight;
      if (data.specifications.metalPurity !== undefined) data.purity = data.specifications.metalPurity;
      if (data.specifications.grossWeight !== undefined) data.grossWt = data.specifications.grossWeight;
      if (data.specifications.netWeight !== undefined) data.netWt = data.specifications.netWeight;
      if (data.specifications.stoneWeight !== undefined) data.stoneWt = data.specifications.stoneWeight;
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
        isDeleted: false,
      });
      if (duplicate) {
        throw new ApiError(409, `Product with SKU "${data.sku}" already exists`);
      }
    }

    const product = await Product.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!product) {
      throw new ApiError(404, 'Product not found');
    }

    return product;
  }

  // ------------------------------- delete product ----------------------------
  async delete(id) {
    const product = await Product.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, status: 'inactive' } },
      { new: true }
    );

    if (!product) {
      throw new ApiError(404, 'Product not found');
    }

    return { message: 'Product deleted successfully', id };
  }
}

module.exports = new ProductService();
