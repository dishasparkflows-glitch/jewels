const mongoose = require('mongoose');
const ProductGroup = require('./productGroup.model');
const Product = require('../product/product.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

// Allowed synchronizable fields mapping
const ALLOWED_SYNC_FIELDS = {
  description: { path: 'basicInfo.description', label: 'Description' },
  title: { path: 'basicInfo.title', label: 'Title' },
  salePrice: { path: 'pricing.salePrice', label: 'Sale Price' },
  images: { path: 'colorImages', label: 'Product Images' },
  descriptionSections: { path: 'descriptionSections', label: 'Description Sections' },
};

const PROTECTED_FIELDS = [
  'basicInfo.sku',
  'sku',
  'ornate.tagNo',
  'tagNo',
  'ornate.barcode',
  'barcode',
  'specifications.metalWeight',
  'metalWeight',
  'ornate.stockQty',
  'stockQty',
  'ornate.isSold',
  'isSold',
  '_id',
  'id',
];

class ProductGroupService {
  /**
   * Generate next sequential group code (e.g. CG-000001)
   */
  async generateGroupCode() {
    const last = await ProductGroup.findOne({}, { groupCode: 1 })
      .sort({ groupCode: -1 })
      .collation({ locale: 'en', numericOrdering: true })
      .lean();

    if (!last || !last.groupCode) {
      return 'CG-000001';
    }

    const match = last.groupCode.match(/CG-(\d+)/i);
    if (!match) {
      const count = await ProductGroup.countDocuments();
      return `CG-${String(count + 1).padStart(6, '0')}`;
    }

    const nextNum = parseInt(match[1], 10) + 1;
    return `CG-${String(nextNum).padStart(6, '0')}`;
  }

  /**
   * Automatically assigns an Ornate product to a matching ProductGroup,
   * or creates a new ProductGroup entry if no matching group exists.
   *
   * @param {Object} product - Upserted product document from MongoDB
   * @param {Object} [label] - Raw Ornate label data from ERP
   * @returns {Promise<Object|null>}
   */
  async assignOrnateProductToGroup(product, label = {}) {
    if (!product || !product._id) return null;

    // 1. Check if product is already assigned to any active group
    const existingAssignment = await ProductGroup.findOne({
      productIds: product._id,
      'meta.deletedAt': null,
    });
    if (existingAssignment) {
      return existingAssignment;
    }

    // 2. Resolve candidate group name
    const candidateName = (
      label?.ItemName ||
      label?.GroupName ||
      product.ornate?.customGroupName ||
      product.ornate?.groupName ||
      product.basicInfo?.title ||
      ''
    ).trim();

    if (!candidateName) return null;

    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const candidateSlug = candidateName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // 3. Search for matching group by name (case-insensitive) or slug
    let matchingGroup = await ProductGroup.findOne({
      $or: [
        { groupName: new RegExp(`^${escapeRegex(candidateName)}$`, 'i') },
        { slug: candidateSlug },
      ],
      'meta.deletedAt': null,
    });

    if (matchingGroup) {
      // Add product to matching group
      const alreadyIncluded = matchingGroup.productIds.some(
        (id) => String(id) === String(product._id)
      );
      if (!alreadyIncluded) {
        matchingGroup.productIds.push(product._id);
      }
      if (!matchingGroup.primaryProductId) {
        matchingGroup.primaryProductId = product._id;
      }
      matchingGroup.meta = matchingGroup.meta || {};
      matchingGroup.meta.updatedAt = new Date();
      await matchingGroup.save();
      return matchingGroup;
    }

    // 4. No matching group found — create a new ProductGroup
    let finalSlug = candidateSlug || `group-${Date.now()}`;
    const slugTaken = await ProductGroup.findOne({
      slug: finalSlug,
      'meta.deletedAt': null,
    });
    if (slugTaken) {
      finalSlug = `${finalSlug}-${Date.now().toString().slice(-4)}`;
    }

    const groupCode = await this.generateGroupCode();

    const newGroup = await ProductGroup.create({
      groupCode,
      groupName: candidateName,
      slug: finalSlug,
      description: `Common product group for ${candidateName}`,
      productIds: [product._id],
      primaryProductId: product._id,
      representativeMode: 'auto',
      status: 'active',
      meta: {
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return newGroup;
  }

  /**
   * Helper to evaluate eligibility of a product for public/group catalogue
   */
  isProductEligible(product) {
    if (!product) return false;
    if (product.meta?.deletedAt) return false;
    const isSold = product.ornate?.isSold || product.stockStatus === 'Sold' || product.status === 'sold';
    if (isSold) return false;
    const isApproved = product.status === 'approved' || product.status === 'active';
    return isApproved;
  }

  /**
   * Extract effective product price
   */
  getProductPrice(product) {
    return Number(product?.pricing?.salePrice || product?.pricing?.mrp || product?.ornate?.goldAmt || 0);
  }

  /**
   * Compute representative product, price range, and counts for a group
   */
  computeGroupSummary(group, products = []) {
    const list = Array.isArray(products) ? products : [];
    const eligibleProducts = list.filter((p) => this.isProductEligible(p));

    const candidatePool = eligibleProducts.length > 0 ? eligibleProducts : list;

    let representative = null;

    // 1. Manual mode
    if (group.representativeMode === 'manual' && group.primaryProductId) {
      const manualProduct = list.find(
        (p) => String(p._id) === String(group.primaryProductId)
      );
      if (manualProduct && this.isProductEligible(manualProduct)) {
        representative = manualProduct;
      }
    }

    // 2. Auto fallback: highest salePrice among eligible, deterministic tie-breaker by _id
    if (!representative && candidatePool.length > 0) {
      const sorted = [...candidatePool].sort((a, b) => {
        const priceDiff = this.getProductPrice(b) - this.getProductPrice(a);
        if (priceDiff !== 0) return priceDiff;
        return String(a._id).localeCompare(String(b._id));
      });
      representative = sorted[0];
    }

    // Price range calculation
    let minPrice = 0;
    let maxPrice = 0;
    if (candidatePool.length > 0) {
      const prices = candidatePool.map((p) => this.getProductPrice(p)).filter((v) => v > 0);
      if (prices.length > 0) {
        minPrice = Math.min(...prices);
        maxPrice = Math.max(...prices);
      }
    }

    const representativePrice = representative ? this.getProductPrice(representative) : 0;

    return {
      totalProducts: list.length,
      eligibleCount: eligibleProducts.length,
      representative,
      representativePrice,
      minPrice,
      maxPrice,
    };
  }

  /**
   * Helper to extract valid image URL from a product document
   */
  extractProductImage(product) {
    if (!product) return null;
    if (product.images && product.images[0]) {
      const img = product.images[0];
      return typeof img === 'string' ? img : img.url;
    }
    if (product.ornate?.ornateImages) {
      if (Array.isArray(product.ornate.ornateImages) && product.ornate.ornateImages[0]) {
        const img = product.ornate.ornateImages[0];
        return typeof img === 'string' ? img : img.url;
      }
      if (typeof product.ornate.ornateImages === 'string' && product.ornate.ornateImages.startsWith('http')) {
        return product.ornate.ornateImages;
      }
    }
    if (product.colorImages && product.colorImages[0]?.images?.[0]) {
      const img = product.colorImages[0].images[0];
      return typeof img === 'string' ? img : img.url;
    }
    if (product.media?.gallery?.[0]?.url) return product.media.gallery[0].url;
    if (product.imageUrl) return product.imageUrl;
    return null;
  }

  /**
   * Resolve 1st product image from a group's products
   */
  getFirstProductImage(products = [], primaryId = null) {
    if (!Array.isArray(products) || !products.length) return null;
    if (primaryId) {
      const primary = products.find((p) => String(p._id) === String(primaryId));
      const pImg = this.extractProductImage(primary);
      if (pImg) return pImg;
    }
    for (const p of products) {
      const img = this.extractProductImage(p);
      if (img) return img;
    }
    return null;
  }

  /**
   * Build condition for filtering groups by their member product status
   */
  async buildProductStatusConditions(statusParam) {
    if (!statusParam || statusParam === 'all') return null;

    if (statusParam === 'draft') {
      const draftProductIds = await Product.find({
        isOrnate: true,
        status: { $in: ['draft', 'inactive'] },
        'meta.deletedAt': null,
      }).distinct('_id');
      return { productIds: { $in: draftProductIds } };
    }

    if (statusParam === 'approved') {
      const approvedProductIds = await Product.find({
        isOrnate: true,
        status: { $in: ['approved', 'active'] },
        'ornate.isSold': { $ne: true },
        stockStatus: { $ne: 'Sold' },
        'meta.deletedAt': null,
      }).distinct('_id');
      return { productIds: { $in: approvedProductIds } };
    }

    if (statusParam === 'sold') {
      const soldProductIds = await Product.find({
        isOrnate: true,
        $or: [
          { 'ornate.isSold': true },
          { stockStatus: 'Sold' },
          { status: 'sold' },
        ],
        'meta.deletedAt': null,
      }).distinct('_id');
      return { productIds: { $in: soldProductIds } };
    }

    return null;
  }

  /**
   * Get accurate counts for all admin Ornate Products tabs
   */
  async getTabCounts() {
    const baseGroupFilter = { status: 'active', 'meta.deletedAt': null };

    // 1. All Groups (all active groups)
    const all = await ProductGroup.countDocuments(baseGroupFilter);

    // 2. Draft Groups: groups containing draft/inactive ornate products
    const draftProductIds = await Product.find({
      isOrnate: true,
      status: { $in: ['draft', 'inactive'] },
      'meta.deletedAt': null,
    }).distinct('_id');

    const draft = await ProductGroup.countDocuments({
      ...baseGroupFilter,
      productIds: { $in: draftProductIds },
    });

    // 3. Approved Groups: groups containing approved ornate products (not sold)
    const approvedProductIds = await Product.find({
      isOrnate: true,
      status: { $in: ['approved', 'active'] },
      'ornate.isSold': { $ne: true },
      stockStatus: { $ne: 'Sold' },
      'meta.deletedAt': null,
    }).distinct('_id');

    const approved = await ProductGroup.countDocuments({
      ...baseGroupFilter,
      productIds: { $in: approvedProductIds },
    });

    // 4. Sold Groups: groups containing sold ornate products
    const soldProductIds = await Product.find({
      isOrnate: true,
      $or: [
        { 'ornate.isSold': true },
        { stockStatus: 'Sold' },
        { status: 'sold' },
      ],
      'meta.deletedAt': null,
    }).distinct('_id');

    const sold = await ProductGroup.countDocuments({
      ...baseGroupFilter,
      productIds: { $in: soldProductIds },
    });

    // 5. Ungrouped (all ornate products count)
    const ungrouped = await Product.countDocuments({
      isOrnate: true,
      'meta.deletedAt': null,
    });

    return {
      all,
      draft,
      approved,
      sold,
      ungrouped,
    };
  }

  /**
   * List Product Groups with search, filters, pagination, and calculated summaries
   */
  async getGroups(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    const statusParam = queryParams.productStatus || queryParams.status;
    const productCondition = await this.buildProductStatusConditions(statusParam);

    if (productCondition) {
      filter.productIds = productCondition.productIds;
      filter.status = 'active';
    } else if (queryParams.status && queryParams.status !== 'all') {
      filter.status = queryParams.status;
    } else if (!queryParams.status || queryParams.status === 'active') {
      filter.status = 'active';
    }

    if (queryParams.search && queryParams.search.trim()) {
      const term = queryParams.search.trim();
      const escaped = term.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const searchRegex = { $regex: escaped, $options: 'i' };

      // Find products matching SKU/tag to match group
      const matchingProductIds = await Product.find(
        {
          isOrnate: true,
          $or: [
            { 'basicInfo.sku': searchRegex },
            { 'ornate.tagNo': searchRegex },
            { 'basicInfo.title': searchRegex },
            { 'ornate.barcode': searchRegex },
          ],
        },
        { _id: 1 }
      ).distinct('_id');

      const searchConditions = [
        { groupName: searchRegex },
        { groupCode: searchRegex },
        { slug: searchRegex },
        { productIds: { $in: matchingProductIds } },
      ];

      if (filter.productIds) {
        filter.$and = [
          { productIds: filter.productIds },
          { $or: searchConditions },
        ];
        delete filter.productIds;
      } else {
        filter.$or = searchConditions;
      }
    }

    const total = await ProductGroup.countDocuments(filter);

    let rawGroups;
    if (queryParams.sort === 'single_first' || !queryParams.sort) {
      const aggregatePipeline = [
        { $match: filter },
        {
          $addFields: {
            productCount: { $size: { $ifNull: ['$productIds', []] } },
            isSingle: {
              $cond: [{ $eq: [{ $size: { $ifNull: ['$productIds', []] } }, 1] }, 0, 1],
            },
          },
        },
        { $sort: { isSingle: 1, 'meta.createdAt': -1, _id: -1 } },
        { $skip: skip },
        { $limit: limit },
      ];
      const matched = await ProductGroup.aggregate(aggregatePipeline);
      rawGroups = await ProductGroup.populate(matched, {
        path: 'productIds',
        select:
          '_id basicInfo pricing specifications ornate colorImages status stockStatus meta',
      });
    } else {
      const sortMap = {
        latest: { 'meta.createdAt': -1, _id: -1 },
        name_asc: { groupName: 1 },
        name_desc: { groupName: -1 },
      };
      const dbSort = sortMap[queryParams.sort] || { 'meta.createdAt': -1, _id: -1 };

      rawGroups = await ProductGroup.find(filter)
        .populate({
          path: 'productIds',
          select:
            '_id basicInfo pricing specifications ornate colorImages status stockStatus meta',
        })
        .sort(dbSort)
        .skip(skip)
        .limit(limit)
        .lean();
    }

    const items = rawGroups.map((g) => {
      const summary = this.computeGroupSummary(g, g.productIds);
      const products = Array.isArray(g.productIds) ? g.productIds : [];
      const imageUrl = this.getFirstProductImage(products, g.primaryProductId) || this.extractProductImage(summary.representative);
      const firstProduct = products.length > 0 ? products[0] : null;

      return {
        _id: g._id,
        groupCode: g.groupCode,
        groupName: g.groupName,
        slug: g.slug,
        description: g.description,
        status: g.status,
        representativeMode: g.representativeMode,
        primaryProductId: g.primaryProductId,
        createdAt: g.meta?.createdAt,
        updatedAt: g.meta?.updatedAt,
        productCount: summary.totalProducts,
        eligibleCount: summary.eligibleCount,
        representative: summary.representative,
        firstProduct: firstProduct ? { _id: firstProduct._id, basicInfo: firstProduct.basicInfo } : null,
        imageUrl,
        firstProductImage: imageUrl,
        representativePrice: summary.representativePrice,
        minPrice: summary.minPrice,
        maxPrice: summary.maxPrice,
      };
    });

    // Custom client-level sorting if price or count sort is requested
    if (queryParams.sort === 'price_asc') {
      items.sort((a, b) => a.minPrice - b.minPrice);
    } else if (queryParams.sort === 'price_desc') {
      items.sort((a, b) => b.maxPrice - a.maxPrice);
    } else if (queryParams.sort === 'count_asc') {
      items.sort((a, b) => a.productCount - b.productCount);
    } else if (queryParams.sort === 'count_desc') {
      items.sort((a, b) => b.productCount - a.productCount);
    }

    return {
      items,
      pagination: getPaginationMeta(total, page, limit),
    };
  }

  /**
   * Lightweight listing — returns groupName, groupCode, productCount, status, and 1st product image
   */
  async getGroupsSummary(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    const statusParam = queryParams.productStatus || queryParams.status;
    const productCondition = await this.buildProductStatusConditions(statusParam);

    if (productCondition) {
      filter.productIds = productCondition.productIds;
      filter.status = 'active';
    } else if (queryParams.status && queryParams.status !== 'all') {
      filter.status = queryParams.status;
    } else if (!queryParams.status || queryParams.status === 'active') {
      filter.status = 'active';
    }

    if (queryParams.search && queryParams.search.trim()) {
      const term = queryParams.search.trim();
      const escaped = term.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const searchRegex = { $regex: escaped, $options: 'i' };

      const matchingProductIds = await Product.find(
        {
          isOrnate: true,
          $or: [
            { 'basicInfo.sku': searchRegex },
            { 'ornate.tagNo': searchRegex },
            { 'basicInfo.title': searchRegex },
            { 'ornate.barcode': searchRegex },
          ],
        },
        { _id: 1 }
      ).distinct('_id');

      const searchConditions = [
        { groupName: searchRegex },
        { groupCode: searchRegex },
        { slug: searchRegex },
        { productIds: { $in: matchingProductIds } },
      ];

      if (filter.productIds) {
        filter.$and = [
          { productIds: filter.productIds },
          { $or: searchConditions },
        ];
        delete filter.productIds;
      } else {
        filter.$or = searchConditions;
      }
    }

    const total = await ProductGroup.countDocuments(filter);

    let rawGroups;
    if (queryParams.sort === 'single_first' || !queryParams.sort) {
      const aggregatePipeline = [
        { $match: filter },
        {
          $addFields: {
            productCount: { $size: { $ifNull: ['$productIds', []] } },
            isSingle: {
              $cond: [{ $eq: [{ $size: { $ifNull: ['$productIds', []] } }, 1] }, 0, 1],
            },
          },
        },
        { $sort: { isSingle: 1, 'meta.createdAt': -1, _id: -1 } },
        { $skip: skip },
        { $limit: limit },
      ];
      const matched = await ProductGroup.aggregate(aggregatePipeline);
      rawGroups = await ProductGroup.populate(matched, {
        path: 'productIds',
        select: '_id basicInfo images ornate.ornateImages colorImages pricing status stockStatus',
      });
    } else {
      const sortMap = {
        latest: { 'meta.createdAt': -1, _id: -1 },
        name_asc: { groupName: 1 },
        name_desc: { groupName: -1 },
      };
      const dbSort = sortMap[queryParams.sort] || { 'meta.createdAt': -1, _id: -1 };

      rawGroups = await ProductGroup.find(filter)
        .populate({
          path: 'productIds',
          select: '_id basicInfo images ornate.ornateImages colorImages pricing status stockStatus',
        })
        .sort(dbSort)
        .skip(skip)
        .limit(limit)
        .lean();
    }

    const items = rawGroups.map((g) => {
      const products = Array.isArray(g.productIds) ? g.productIds : [];
      const imageUrl = this.getFirstProductImage(products, g.primaryProductId);
      return {
        _id: g._id,
        groupCode: g.groupCode,
        groupName: g.groupName,
        status: g.status,
        productCount: products.length,
        createdAt: g.meta?.createdAt,
        imageUrl,
        firstProductImage: imageUrl,
      };
    });

    return {
      items,
      pagination: getPaginationMeta(total, page, limit),
    };
  }

  /**
   * Get single group details with fully populated products
   */
  async getGroupById(id) {
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const filter = isObjectId
      ? { $or: [{ _id: id }, { groupCode: id }, { slug: id }], 'meta.deletedAt': null }
      : { $or: [{ groupCode: id }, { slug: id }], 'meta.deletedAt': null };

    const group = await ProductGroup.findOne(filter)
      .populate({
        path: 'productIds',
        select:
          '_id basicInfo pricing specifications ornate colorImages status stockStatus productType isOrnate meta',
      })
      .lean();

    if (!group) {
      throw new ApiError(404, 'Product group not found');
    }

    const summary = this.computeGroupSummary(group, group.productIds);

    return {
      ...group,
      productCount: summary.totalProducts,
      eligibleCount: summary.eligibleCount,
      representative: summary.representative,
      representativePrice: summary.representativePrice,
      minPrice: summary.minPrice,
      maxPrice: summary.maxPrice,
      products: group.productIds,
    };
  }

  /**
   * Create new product group with validated membership
   */
  async createGroup(data, userId = null) {
    const groupName = data.groupName?.trim();
    if (!groupName) {
      throw new ApiError(400, 'Group name is required');
    }

    // Generate safe slug
    const safeSlug = (data.slug || groupName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const existingSlug = await ProductGroup.findOne({
      slug: safeSlug,
      'meta.deletedAt': null,
    });
    if (existingSlug) {
      throw new ApiError(409, `A group with slug "${safeSlug}" already exists`);
    }

    // Validate product IDs
    const rawIds = Array.isArray(data.productIds) ? data.productIds : [];
    const validIds = rawIds.filter((id) => mongoose.isValidObjectId(id));

    if (validIds.length > 0) {
      // Check existing active membership conflicts
      const conflicts = await ProductGroup.find({
        status: 'active',
        'meta.deletedAt': null,
        productIds: { $in: validIds },
      })
        .select('groupName productIds')
        .lean();

      if (conflicts.length > 0) {
        const conflictGroup = conflicts[0];
        throw new ApiError(
          409,
          `One or more selected products are already assigned to active group "${conflictGroup.groupName}". Use Move Product to transfer them.`
        );
      }
    }

    const groupCode = data.groupCode || (await this.generateGroupCode());

    // Validate primaryProductId
    let primaryProductId = data.primaryProductId || null;
    let representativeMode = data.representativeMode || 'auto';
    if (primaryProductId && !validIds.some((id) => String(id) === String(primaryProductId))) {
      primaryProductId = null;
      representativeMode = 'auto';
    }

    const group = await ProductGroup.create({
      groupCode,
      groupName,
      slug: safeSlug,
      description: data.description || '',
      productIds: validIds,
      primaryProductId,
      representativeMode,
      status: data.status || 'active',

      meta: {
        createdBy: userId,
        updatedBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return this.getGroupById(group._id);
  }

  /**
   * Update group properties (name, slug, description, status, representativeMode, primaryProductId)
   */
  async updateGroup(id, data, userId = null) {
    const group = await ProductGroup.findOne({ _id: id, 'meta.deletedAt': null });
    if (!group) throw new ApiError(404, 'Product group not found');

    if (data.groupName && data.groupName.trim()) {
      group.groupName = data.groupName.trim();
    }

    if (data.slug && data.slug.trim()) {
      const nextSlug = data.slug.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
      const conflict = await ProductGroup.findOne({
        slug: nextSlug,
        _id: { $ne: id },
        'meta.deletedAt': null,
      });
      if (conflict) {
        throw new ApiError(409, `A group with slug "${nextSlug}" already exists`);
      }
      group.slug = nextSlug;
    }

    if (data.description !== undefined) {
      group.description = data.description;
    }

    if (data.status && ['active', 'inactive'].includes(data.status)) {
      group.status = data.status;
    }

    if (data.representativeMode && ['auto', 'manual'].includes(data.representativeMode)) {
      group.representativeMode = data.representativeMode;
    }

    if (data.primaryProductId !== undefined || data.representativeId !== undefined) {
      const newPrimary = data.primaryProductId || data.representativeId;
      if (newPrimary) {
        const isMember = group.productIds.some((pId) => String(pId) === String(newPrimary));
        if (!isMember) {
          throw new ApiError(400, 'Primary product must be a member of this group');
        }
        group.primaryProductId = newPrimary;
        group.representativeMode = 'manual';
      } else {
        group.primaryProductId = null;
        group.representativeMode = 'auto';
      }
    }

    if (userId) {
      group.meta = group.meta || {};
      group.meta.updatedBy = userId;
    }

    await group.save();
    return this.getGroupById(group._id);
  }

  /**
   * Soft delete product group (never deletes products)
   */
  async deleteGroup(id, userId = null) {
    const group = await ProductGroup.findOneAndUpdate(
      { _id: id, 'meta.deletedAt': null },
      {
        $set: {
          status: 'inactive',
          'meta.deletedAt': new Date(),
          'meta.deletedBy': userId,
        },
      },
      { returnDocument: 'after' }
    );

    if (!group) throw new ApiError(404, 'Product group not found');

    return {
      message: 'Product group deleted successfully. Member products were preserved.',
      id,
    };
  }

  /**
   * Add products to group
   */
  async addProducts(groupId, productIds = [], userId = null) {
    const group = await ProductGroup.findOne({ _id: groupId, 'meta.deletedAt': null });
    if (!group) throw new ApiError(404, 'Product group not found');

    const validIds = productIds.filter((id) => mongoose.isValidObjectId(id));
    if (!validIds.length) {
      throw new ApiError(400, 'No valid product IDs provided');
    }

    // Verify products exist and are not already in another active group
    const conflicts = await ProductGroup.find({
      _id: { $ne: groupId },
      status: 'active',
      'meta.deletedAt': null,
      productIds: { $in: validIds },
    })
      .select('groupName')
      .lean();

    if (conflicts.length > 0) {
      throw new ApiError(
        409,
        `One or more products already belong to group "${conflicts[0].groupName}". Please use Move Product.`
      );
    }

    await ProductGroup.findByIdAndUpdate(groupId, {
      $addToSet: { productIds: { $each: validIds } },
      $set: { 'meta.updatedBy': userId, 'meta.updatedAt': new Date() },
    });

    return this.getGroupById(groupId);
  }

  /**
   * Remove a single product from group
   */
  async removeProduct(groupId, productId, userId = null) {
    const group = await ProductGroup.findOne({ _id: groupId, 'meta.deletedAt': null });
    if (!group) throw new ApiError(404, 'Product group not found');

    const update = {
      $pull: { productIds: productId },
      $set: { 'meta.updatedBy': userId, 'meta.updatedAt': new Date() },
    };

    if (String(group.primaryProductId) === String(productId)) {
      update.$set.primaryProductId = null;
      update.$set.representativeMode = 'auto';
    }

    await ProductGroup.findByIdAndUpdate(groupId, update);

    return this.getGroupById(groupId);
  }

  /**
   * Explicitly move products from one group to another or split into individual groups
   */
  async moveProducts({ sourceGroupId, targetGroupId, newGroupName, productIds, splitIndividual = false, userId = null }) {
    if (!sourceGroupId) {
      throw new ApiError(400, 'Source group ID is required');
    }

    const sourceGroup = await ProductGroup.findOne({ _id: sourceGroupId, 'meta.deletedAt': null });
    if (!sourceGroup) throw new ApiError(404, 'Source group not found');

    const validIds = (productIds || []).filter((id) => mongoose.isValidObjectId(id));
    if (!validIds.length) {
      throw new ApiError(400, 'No valid product IDs provided to move');
    }

    // CASE 0: Split selected products into individual separate groups (1 product per group)
    if (splitIndividual) {
      return this.splitProductsIntoIndividualGroups({
        sourceGroupId,
        productIds: validIds,
        userId,
      });
    }

    // Pull from source
    const sourceUpdate = {
      $pull: { productIds: { $in: validIds } },
      $set: { 'meta.updatedBy': userId, 'meta.updatedAt': new Date() },
    };
    if (validIds.some((id) => String(id) === String(sourceGroup.primaryProductId))) {
      sourceUpdate.$set.primaryProductId = null;
      sourceUpdate.$set.representativeMode = 'auto';
    }

    // CASE 1: Create another group with auto/custom name
    if (newGroupName && newGroupName.trim()) {
      const trimmedName = newGroupName.trim();
      let safeSlug = trimmedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      if (!safeSlug) {
        safeSlug = `group-${Date.now().toString(36)}`;
      }

      const existingSlug = await ProductGroup.findOne({
        slug: safeSlug,
        'meta.deletedAt': null,
      });
      if (existingSlug) {
        safeSlug = `${safeSlug}-${Date.now().toString(36)}`;
      }

      const groupCode = await this.generateGroupCode();

      // Pull from source group
      await ProductGroup.findByIdAndUpdate(sourceGroupId, sourceUpdate);

      // Create new group
      const newGroup = await ProductGroup.create({
        groupCode,
        groupName: trimmedName,
        slug: safeSlug,
        description: '',
        productIds: validIds,
        primaryProductId: validIds[0] || null,
        representativeMode: 'auto',
        status: 'active',

        meta: {
          createdBy: userId,
          updatedBy: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      return {
        message: `Successfully created group "${newGroup.groupName}" and moved ${validIds.length} product(s)`,
        sourceGroupId,
        targetGroupId: newGroup._id,
        newGroup,
        movedCount: validIds.length,
      };
    }

    // CASE 2: Move to an existing target group
    if (!targetGroupId) {
      throw new ApiError(400, 'Target group ID or New group name is required');
    }
    if (String(sourceGroupId) === String(targetGroupId)) {
      throw new ApiError(400, 'Source and target groups must be different');
    }

    const targetGroup = await ProductGroup.findOne({ _id: targetGroupId, 'meta.deletedAt': null });
    if (!targetGroup) throw new ApiError(404, 'Target group not found');

    // Pull from source
    await ProductGroup.findByIdAndUpdate(sourceGroupId, sourceUpdate);

    // Push to target
    await ProductGroup.findByIdAndUpdate(targetGroupId, {
      $addToSet: { productIds: { $each: validIds } },
      $set: { 'meta.updatedBy': userId, 'meta.updatedAt': new Date() },
    });

    return {
      message: `Successfully moved ${validIds.length} product(s) to ${targetGroup.groupName}`,
      sourceGroupId,
      targetGroupId,
      movedCount: validIds.length,
    };
  }

  /**
   * Split products into individual groups (1 product per group) in one single click
   */
  async splitProductsIntoIndividualGroups({ sourceGroupId = null, productIds = [], userId = null }) {
    const validIds = (productIds || []).filter((id) => mongoose.isValidObjectId(id));
    if (!validIds.length) {
      throw new ApiError(400, 'No valid product IDs provided to split');
    }

    let sourceGroup = null;
    let sourceGroupDeleted = false;

    if (sourceGroupId) {
      sourceGroup = await ProductGroup.findOne({ _id: sourceGroupId, 'meta.deletedAt': null });
      if (!sourceGroup) throw new ApiError(404, 'Source group not found');

      const remainingProductIds = (sourceGroup.productIds || []).filter(
        (id) => !validIds.some((vId) => String(vId) === String(id))
      );

      if (remainingProductIds.length === 0) {
        // Source group is now empty — soft delete it so no orphan 0-item group lingers
        await ProductGroup.findByIdAndUpdate(sourceGroupId, {
          $set: {
            productIds: [],
            primaryProductId: null,
            'meta.deletedAt': new Date(),
            'meta.deletedBy': userId,
          },
        });
        sourceGroupDeleted = true;
      } else {
        const sourceUpdate = {
          $set: {
            productIds: remainingProductIds,
            'meta.updatedBy': userId,
            'meta.updatedAt': new Date(),
          },
        };
        if (validIds.some((id) => String(id) === String(sourceGroup.primaryProductId))) {
          sourceUpdate.$set.primaryProductId = remainingProductIds[0] || null;
          sourceUpdate.$set.representativeMode = 'auto';
        }
        await ProductGroup.findByIdAndUpdate(sourceGroupId, sourceUpdate);
      }
    } else {
      // Pull products from any active groups they might currently belong to
      await ProductGroup.updateMany(
        { productIds: { $in: validIds }, 'meta.deletedAt': null },
        {
          $pull: { productIds: { $in: validIds } },
          $set: { 'meta.updatedBy': userId, 'meta.updatedAt': new Date() },
        }
      );
    }

    // Fetch the products to inspect details for auto-naming
    const products = await Product.find({ _id: { $in: validIds } }).lean();
    if (!products.length) {
      throw new ApiError(404, 'No products found matching the provided IDs');
    }

    // Find the next available group code number
    const last = await ProductGroup.findOne({}, { groupCode: 1 })
      .sort({ groupCode: -1 })
      .collation({ locale: 'en', numericOrdering: true })
      .lean();

    let currentNum = 1;
    if (last && last.groupCode) {
      const match = last.groupCode.match(/CG-(\d+)/i);
      if (match) {
        currentNum = parseInt(match[1], 10) + 1;
      } else {
        const count = await ProductGroup.countDocuments();
        currentNum = count + 1;
      }
    }

    const createdGroups = [];
    const now = new Date();

    for (const p of products) {
      const itemName = (
        p.basicInfo?.title ||
        p.title ||
        p.name ||
        p.ornate?.customGroupName ||
        p.ornate?.itemCode ||
        'Product'
      ).trim();

      const identifier = (
        p.ornate?.barcode ||
        p.barcode ||
        p.ornate?.tagNo ||
        p.basicInfo?.sku ||
        ''
      ).trim();

      const groupName =
        identifier && !itemName.toLowerCase().includes(identifier.toLowerCase())
          ? `${itemName} - ${identifier}`
          : itemName || identifier || 'Common Group';

      const codeStr = String(currentNum).padStart(6, '0');
      const groupCode = `CG-${codeStr}`;
      currentNum++;

      let baseSlug = groupName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      if (!baseSlug) baseSlug = `group-${Date.now().toString(36)}`;
      const slug = `${baseSlug}-${codeStr.toLowerCase()}`;

      createdGroups.push({
        groupCode,
        groupName,
        slug,
        description: '',
        productIds: [p._id],
        primaryProductId: p._id,
        representativeMode: 'auto',
        status: 'active',
        meta: {
          createdBy: userId,
          updatedBy: userId,
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    const inserted = await ProductGroup.insertMany(createdGroups);

    return {
      message: `Successfully created ${inserted.length} separate group${inserted.length === 1 ? '' : 's'} (1 per product)`,
      count: inserted.length,
      createdGroups: inserted,
      sourceGroupDeleted,
    };
  }

  /**
   * Approve products in a group where stockStatus is In Stock
   */
  async approveGroup(groupId, productIds = null, userId = null) {
    const group = await ProductGroup.findOne({ _id: groupId, 'meta.deletedAt': null });
    if (!group) throw new ApiError(404, 'Product group not found');

    let targetIds = group.productIds || [];
    if (Array.isArray(productIds) && productIds.length > 0) {
      const validCustom = productIds.filter((id) => mongoose.isValidObjectId(id));
      if (validCustom.length > 0) {
        targetIds = targetIds.filter((id) =>
          validCustom.some((cId) => String(cId) === String(id))
        );
      }
    }

    if (!targetIds.length) {
      throw new ApiError(400, 'No products found in this group to approve');
    }

    // Filter where stockStatus is 'In Stock' and not sold/deleted
    const filter = {
      _id: { $in: targetIds },
      'meta.deletedAt': null,
      'ornate.isSold': { $ne: true },
      $or: [
        { stockStatus: 'In Stock' },
        { stockStatus: { $regex: /^in stock$/i } },
        { stockStatus: { $exists: false } },
        { stockStatus: null },
      ],
    };

    const updateResult = await Product.updateMany(filter, {
      $set: {
        status: 'approved',
        'meta.updatedBy': userId,
        'meta.updatedAt': new Date(),
      },
    });

    const updatedGroup = await this.getGroupById(groupId);

    return {
      message: `Successfully approved ${updateResult.modifiedCount} in-stock product(s) in "${group.groupName}"`,
      approvedCount: updateResult.modifiedCount,
      group: updatedGroup,
    };
  }

  /**
   * Bulk approve products across multiple groups
   * @param {Array<string>} groupIds - List of ProductGroup IDs
   * @param {string} userId - Admin user ID
   */
  async bulkApproveGroups(groupIds = [], userId = null) {
    if (!Array.isArray(groupIds) || groupIds.length === 0) {
      throw new ApiError(400, 'Please select at least one group to approve');
    }

    const validGroupIds = groupIds.filter((id) => mongoose.isValidObjectId(id));
    if (!validGroupIds.length) {
      throw new ApiError(400, 'No valid group IDs provided');
    }

    // Find all active groups
    const groups = await ProductGroup.find({
      _id: { $in: validGroupIds },
      'meta.deletedAt': null,
    }).select('_id productIds groupName');

    if (!groups.length) {
      throw new ApiError(404, 'No matching product groups found');
    }

    // Collect all unique productIds
    const allProductIds = [];
    groups.forEach((g) => {
      if (Array.isArray(g.productIds)) {
        g.productIds.forEach((pid) => {
          if (pid) allProductIds.push(pid);
        });
      }
    });

    if (!allProductIds.length) {
      throw new ApiError(400, 'No products found in the selected groups to approve');
    }

    // Filter where stockStatus is In Stock and not sold/deleted
    const filter = {
      _id: { $in: allProductIds },
      'meta.deletedAt': null,
      'ornate.isSold': { $ne: true },
      $or: [
        { stockStatus: 'In Stock' },
        { stockStatus: { $regex: /^in stock$/i } },
        { stockStatus: { $exists: false } },
        { stockStatus: null },
      ],
    };

    const updateResult = await Product.updateMany(filter, {
      $set: {
        status: 'approved',
        'meta.updatedBy': userId,
        'meta.updatedAt': new Date(),
      },
    });

    return {
      message: `Successfully approved ${updateResult.modifiedCount} product(s) across ${groups.length} group(s)`,
      approvedCount: updateResult.modifiedCount,
      groupsCount: groups.length,
    };
  }

  /**
   * Get eligible products not belonging to any active group
   */
  async getUngroupedProducts(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);

    // 1. Collect all productIds in active groups
    const activeGroups = await ProductGroup.find(
      { status: 'active', 'meta.deletedAt': null },
      { productIds: 1 }
    ).lean();

    const activeMemberProductIds = [
      ...new Set(activeGroups.flatMap((g) => (g.productIds || []).map(String))),
    ].map((id) => new mongoose.Types.ObjectId(id));

    const filter = {
      isOrnate: true,
      'meta.deletedAt': null,
      _id: { $nin: activeMemberProductIds },
    };

    if (queryParams.search && queryParams.search.trim()) {
      const term = queryParams.search.trim();
      const escaped = term.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const searchRegex = { $regex: escaped, $options: 'i' };

      filter.$or = [
        { 'basicInfo.title': searchRegex },
        { 'basicInfo.sku': searchRegex },
        { 'ornate.tagNo': searchRegex },
        { 'ornate.barcode': searchRegex },
        { 'ornate.customGroupName': searchRegex },
      ];
    }

    const total = await Product.countDocuments(filter);

    let dbSort = { 'meta.createdAt': -1, _id: -1 };
    if (queryParams.sort === 'price_desc' || queryParams.sort === 'price-high') {
      dbSort = { 'pricing.salePrice': -1, 'pricing.mrp': -1, _id: -1 };
    } else if (queryParams.sort === 'price_asc' || queryParams.sort === 'price-low') {
      dbSort = { 'pricing.salePrice': 1, 'pricing.mrp': 1, _id: -1 };
    } else if (queryParams.sort === 'name_asc') {
      dbSort = { 'basicInfo.title': 1, _id: -1 };
    }

    const items = await Product.find(filter)
      .select(
        '_id basicInfo pricing specifications ornate colorImages status stockStatus productType isOrnate meta'
      )
      .sort(dbSort)
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      items,
      pagination: getPaginationMeta(total, page, limit),
    };
  }

  /**
   * Preview synchronization of fields from source product to targets without mutation
   */
  async previewSync({ groupId, sourceProductId, targetProductIds = [], fields = [] }) {
    const group = await ProductGroup.findOne({ _id: groupId, 'meta.deletedAt': null });
    if (!group) throw new ApiError(404, 'Product group not found');

    const source = await Product.findOne({ _id: sourceProductId, 'meta.deletedAt': null }).lean();
    if (!source) throw new ApiError(404, 'Source product not found');

    // Verify source is member of group
    if (!group.productIds.some((pId) => String(pId) === String(sourceProductId))) {
      throw new ApiError(400, 'Source product must belong to this group');
    }

    // Filter fields against allowlist and protected fields
    const validFields = fields.filter((f) => {
      if (PROTECTED_FIELDS.includes(f)) return false;
      return Boolean(ALLOWED_SYNC_FIELDS[f]);
    });

    if (!validFields.length) {
      throw new ApiError(
        400,
        'No valid synchronizable fields selected. Protected fields (SKU, tag, weight, stock) cannot be synced.'
      );
    }

    // Determine target products
    let targets = [];
    if (Array.isArray(targetProductIds) && targetProductIds.length > 0) {
      targets = await Product.find({
        _id: { $in: targetProductIds.filter((id) => String(id) !== String(sourceProductId)) },
        'meta.deletedAt': null,
      }).lean();
    } else {
      // Default: all other products in the group
      targets = await Product.find({
        _id: {
          $in: group.productIds.filter((id) => String(id) !== String(sourceProductId)),
        },
        'meta.deletedAt': null,
      }).lean();
    }

    const previewList = targets.map((target) => {
      const changes = [];
      validFields.forEach((f) => {
        let beforeVal;
        let afterVal;

        if (f === 'description') {
          beforeVal = target.basicInfo?.description || '';
          afterVal = source.basicInfo?.description || '';
        } else if (f === 'title') {
          beforeVal = target.basicInfo?.title || '';
          afterVal = source.basicInfo?.title || '';
        } else if (f === 'salePrice') {
          beforeVal = target.pricing?.salePrice || 0;
          afterVal = source.pricing?.salePrice || 0;
        } else if (f === 'images') {
          beforeVal = target.colorImages || [];
          afterVal = source.colorImages || [];
        } else if (f === 'descriptionSections') {
          beforeVal = target.descriptionSections || [];
          afterVal = source.descriptionSections || [];
        }

        changes.push({
          field: f,
          label: ALLOWED_SYNC_FIELDS[f].label,
          before: beforeVal,
          after: afterVal,
        });
      });

      return {
        id: target._id,
        title: target.basicInfo?.title || target.name || 'Unnamed Product',
        tag: target.ornate?.tagNo || '—',
        sku: target.basicInfo?.sku || '—',
        changes,
      };
    });

    return {
      groupId: group._id,
      groupName: group.groupName,
      sourceProduct: {
        id: source._id,
        title: source.basicInfo?.title,
        tag: source.ornate?.tagNo,
        sku: source.basicInfo?.sku,
      },
      selectedFields: validFields,
      targetCount: targets.length,
      preview: previewList,
    };
  }

  /**
   * Execute validated synchronization and commit first-sync / sync-log metadata
   */
  async executeSync({ groupId, sourceProductId, targetProductIds = [], fields = [], userId = null }) {
    const group = await ProductGroup.findOne({ _id: groupId, 'meta.deletedAt': null });
    if (!group) throw new ApiError(404, 'Product group not found');

    const source = await Product.findOne({ _id: sourceProductId, 'meta.deletedAt': null }).lean();
    if (!source) throw new ApiError(404, 'Source product not found');

    if (!group.productIds.some((pId) => String(pId) === String(sourceProductId))) {
      throw new ApiError(400, 'Source product must belong to this group');
    }

    const validFields = fields.filter((f) => {
      if (PROTECTED_FIELDS.includes(f)) return false;
      return Boolean(ALLOWED_SYNC_FIELDS[f]);
    });

    if (!validFields.length) {
      throw new ApiError(400, 'No valid synchronizable fields selected.');
    }

    let targetIds = targetProductIds;
    if (!Array.isArray(targetIds) || !targetIds.length) {
      targetIds = group.productIds.filter((id) => String(id) !== String(sourceProductId));
    } else {
      targetIds = targetIds.filter((id) => String(id) !== String(sourceProductId));
    }

    const targets = await Product.find({
      _id: { $in: targetIds },
      'meta.deletedAt': null,
    }).lean();

    if (!targets.length) {
      throw new ApiError(400, 'No target products available to sync');
    }

    // Build update mutation object from source values
    const updatePayload = {};
    validFields.forEach((f) => {
      if (f === 'description') {
        updatePayload['basicInfo.description'] = source.basicInfo?.description || '';
      } else if (f === 'title') {
        updatePayload['basicInfo.title'] = source.basicInfo?.title || '';
      } else if (f === 'salePrice') {
        updatePayload['pricing.salePrice'] = source.pricing?.salePrice || 0;
      } else if (f === 'images') {
        updatePayload.colorImages = source.colorImages || [];
      } else if (f === 'descriptionSections') {
        updatePayload.descriptionSections = source.descriptionSections || [];
      }
    });

    const now = new Date();

    // Track per-product diffs for audit log
    const auditChanges = [];
    const updateWrites = [];

    targets.forEach((target) => {
      const fieldChanges = [];
      validFields.forEach((f) => {
        let beforeVal;
        let afterVal;
        if (f === 'description') {
          beforeVal = target.basicInfo?.description || '';
          afterVal = source.basicInfo?.description || '';
        } else if (f === 'title') {
          beforeVal = target.basicInfo?.title || '';
          afterVal = source.basicInfo?.title || '';
        } else if (f === 'salePrice') {
          beforeVal = target.pricing?.salePrice || 0;
          afterVal = source.pricing?.salePrice || 0;
        } else if (f === 'images') {
          beforeVal = target.colorImages || [];
          afterVal = source.colorImages || [];
        } else if (f === 'descriptionSections') {
          beforeVal = target.descriptionSections || [];
          afterVal = source.descriptionSections || [];
        }

        fieldChanges.push({ field: f, before: beforeVal, after: afterVal });
      });

      auditChanges.push({
        productId: target._id,
        productTag: target.ornate?.tagNo || '',
        productSku: target.basicInfo?.sku || '',
        productTitle: target.basicInfo?.title || '',
        fieldChanges,
        status: 'success',
      });

      updateWrites.push({
        updateOne: {
          filter: { _id: target._id },
          update: {
            $set: {
              ...updatePayload,
              'meta.updatedBy': userId,
              'meta.updatedAt': now,
            },
          },
        },
      });
    });

    // 1. Commit product writes
    if (updateWrites.length > 0) {
      await Product.bulkWrite(updateWrites);
    }

    // Update product group modified metadata
    await ProductGroup.findByIdAndUpdate(groupId, {
      $set: {
        'meta.updatedBy': userId,
        'meta.updatedAt': now,
      },
    });

    return {
      message: 'Group synchronized successfully',
      operationId,
      updatedCount: targets.length,
      fields: validFields,
      completedAt: new Date(),
    };
  }
}

module.exports = new ProductGroupService();
