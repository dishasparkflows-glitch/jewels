const Product = require('./product.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class ProductService {
  // ------------------------------- create product ----------------------------
  async create(data) {
    if (data.productType === 'ornate' || data.isOrnate || data.tagNo) {
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
        { 'ornateData.groupName': searchRegex },
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
        .sort({ createdAt: -1 })
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
