const mongoose = require('mongoose');
const Diamond = require('./diamond.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

function getSafePopulates() {
  const fields = [];
  if (mongoose.models['DiamondColor']) fields.push({ path: 'color' });
  if (mongoose.models['DiamondClarity']) fields.push({ path: 'clarity' });
  if (mongoose.models['DiamondShape']) fields.push({ path: 'shape' });
  if (mongoose.models['DiamondType']) fields.push({ path: 'type' });
  return fields;
}

class DiamondService {
  // ------------------------------- create diamond ----------------------------
  async create(data) {
    if (data.sku) {
      data.sku = data.sku.trim();
      const existing = await Diamond.findOne({ sku: data.sku, isDeleted: false });
      if (existing) {
        throw new ApiError(409, `Diamond with SKU "${data.sku}" already exists`);
      }
    }
    return await Diamond.create(data);
  }

  // ------------------------------- get one diamond ----------------------------

  async getOne(id) {
    let query = Diamond.findOne({ _id: id, isDeleted: false });
    const populates = getSafePopulates();
    if (populates.length > 0) {
      query = query.populate(populates);
    }
    const item = await query.lean();

    if (!item) {
      throw new ApiError(404, 'Diamond not found');
    }
    return item;
  }

  async getBySku(sku) {
    let query = Diamond.findOne({
      sku: sku.trim(),
      isDeleted: false,
    });
    const populates = getSafePopulates();
    if (populates.length > 0) {
      query = query.populate(populates);
    }
    const item = await query.lean();

    if (!item) {
      throw new ApiError(404, `Diamond with SKU "${sku}" not found`);
    }
    return item;
  }

  // ------------------------------- get all diamonds ----------------------------

  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { isDeleted: false };

    if (queryParams.status) filter.status = queryParams.status;
    if (queryParams.color) filter.color = queryParams.color;
    if (queryParams.clarity) filter.clarity = queryParams.clarity;
    if (queryParams.shape) filter.shape = queryParams.shape;
    if (queryParams.type) filter.type = queryParams.type;

    if (queryParams.minCarat || queryParams.maxCarat) {
      filter.carat = {};
      if (queryParams.minCarat) filter.carat.$gte = Number(queryParams.minCarat);
      if (queryParams.maxCarat) filter.carat.$lte = Number(queryParams.maxCarat);
    }

    if (queryParams.minPrice || queryParams.maxPrice) {
      filter.price = {};
      if (queryParams.minPrice) filter.price.$gte = Number(queryParams.minPrice);
      if (queryParams.maxPrice) filter.price.$lte = Number(queryParams.maxPrice);
    }

    if (queryParams.search) {
      filter.$or = [
        { sku: new RegExp(queryParams.search, 'i') },
        { title: new RegExp(queryParams.search, 'i') },
        { description: new RegExp(queryParams.search, 'i') },
      ];
    }

    let findQuery = Diamond.find(filter)
      .sort({ 'meta.createdAt': -1 })
      .skip(skip)
      .limit(limit);

    const populates = getSafePopulates();
    if (populates.length > 0) {
      findQuery = findQuery.populate(populates);
    }

    const [items, total] = await Promise.all([
      findQuery.lean(),
      Diamond.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get diamond lookup ----------------------------

  async getLookup(queryParams = {}) {
    const filter = { isDeleted: false, status: 'active' };

    if (queryParams.color) filter.color = queryParams.color;
    if (queryParams.clarity) filter.clarity = queryParams.clarity;
    if (queryParams.shape) filter.shape = queryParams.shape;
    if (queryParams.type) filter.type = queryParams.type;

    return await Diamond.find(filter)
      .select('_id sku title price carat rate image color clarity shape type')
      .sort({ carat: 1, price: 1 })
      .lean();
  }

  // ------------------------------- update diamond ----------------------------

  async update(id, data) {
    if (data.sku) {
      data.sku = data.sku.trim();
      const existing = await Diamond.findOne({
        sku: data.sku,
        _id: { $ne: id },
        isDeleted: false,
      });
      if (existing) {
        throw new ApiError(409, `Diamond with SKU "${data.sku}" already exists`);
      }
    }

    let updateQuery = Diamond.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );

    const populates = getSafePopulates();
    if (populates.length > 0) {
      updateQuery = updateQuery.populate(populates);
    }

    const item = await updateQuery;

    if (!item) {
      throw new ApiError(404, 'Diamond not found');
    }

    return item;
  }

  // ------------------------------- delete diamond ----------------------------

  async delete(id) {
    const item = await Diamond.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, status: 'inactive' } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'Diamond not found');
    }

    return { message: 'Diamond deleted successfully', id };
  }
}

module.exports = new DiamondService();
