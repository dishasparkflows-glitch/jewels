const CustJewelleryBeforAfter = require('./custJewelleryBeforeAfter.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const cloudflareR2 = require('../../utils/cloudflareR2');

function extractImageKeys(item) {
  const keys = [];
  if (item?.beforeImage) {
    const k = item.beforeImage.key || item.beforeImage.url;
    if (k) keys.push(k);
  }
  if (item?.afterImage) {
    const k = item.afterImage.key || item.afterImage.url;
    if (k) keys.push(k);
  }
  return keys;
}

async function deleteR2Files(keys = []) {
  if (!keys || keys.length === 0) return;
  const promises = keys.map(async (k) => {
    try {
      await cloudflareR2.deleteFile(k);
    } catch (err) {
      console.error(`[Cloudflare R2] Failed to delete file "${k}":`, err.message);
    }
  });
  await Promise.allSettled(promises);
}

class CustJewelleryBeforeAfterService {
  // ------------------------------- create cust jewellery before after ----------------------------
  async create(data) {
    return await CustJewelleryBeforAfter.create(data);
  }

  // ------------------------------- get one cust jewellery before after ----------------------------
  async getOne(id) {
    const item = await CustJewelleryBeforAfter.findOne({ _id: id });
    if (!item) {
      throw new ApiError(404, 'Before/After showcase entry not found');
    }
    return item;
  }

  // ------------------------------- get all cust jewellery before after ----------------------------
  async getAll(queryParams = {}) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = {};

    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    if (queryParams.search) {
      filter.alt = new RegExp(queryParams.search, 'i');
    }

    const [items, total] = await Promise.all([
      CustJewelleryBeforAfter.find(filter)
        .sort({ position: 1, 'meta.createdAt': -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CustJewelleryBeforAfter.countDocuments(filter),
    ]);

    return { items, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get cust jewellery before after lookup ----------------------------
  async getLookup(queryParams = {}) {
    const filter = { status: 'active' };
    return await CustJewelleryBeforAfter.find(filter)
      .sort({ position: 1, 'meta.createdAt': -1, createdAt: -1 })
      .select('_id beforeImage afterImage alt position')
      .lean();
  }

  // ------------------------------- update cust jewellery before after ----------------------------
  async update(id, data) {
    const existing = await CustJewelleryBeforAfter.findById(id);
    if (!existing) {
      throw new ApiError(404, 'Before/After showcase entry not found');
    }

    // If beforeImage or afterImage is replaced, delete old file from Cloudflare R2
    const keysToClean = [];
    if (data.beforeImage && (data.beforeImage.key || data.beforeImage.url)) {
      const oldKey = existing.beforeImage?.key || existing.beforeImage?.url;
      const newKey = data.beforeImage.key || data.beforeImage.url;
      if (oldKey && oldKey !== newKey) {
        keysToClean.push(oldKey);
      }
    }
    if (data.afterImage && (data.afterImage.key || data.afterImage.url)) {
      const oldKey = existing.afterImage?.key || existing.afterImage?.url;
      const newKey = data.afterImage.key || data.afterImage.url;
      if (oldKey && oldKey !== newKey) {
        keysToClean.push(oldKey);
      }
    }

    const item = await CustJewelleryBeforAfter.findOneAndUpdate(
      { _id: id },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    );

    if (keysToClean.length > 0) {
      await deleteR2Files(keysToClean);
    }

    return item;
  }

  // ------------------------------- bulk delete cust jewellery before after ----------------------------
  async bulkDelete(ids = []) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, 'ids array is required for bulk delete');
    }

    // 1. Find all documents to retrieve Cloudflare R2 image keys before deleting
    const items = await CustJewelleryBeforAfter.find({ _id: { $in: ids } }).lean();
    if (!items || items.length === 0) {
      throw new ApiError(404, 'No showcase entries found for deletion');
    }

    // 2. Extract image keys
    const keysToDelete = [];
    items.forEach((item) => {
      keysToDelete.push(...extractImageKeys(item));
    });

    // 3. Hard delete records from MongoDB
    const result = await CustJewelleryBeforAfter.deleteMany({ _id: { $in: ids } });

    // 4. Delete corresponding image files from Cloudflare R2
    await deleteR2Files(keysToDelete);

    return {
      message: `${result.deletedCount || items.length} showcase entry/entries hard deleted successfully`,
      deletedCount: result.deletedCount || items.length,
      ids,
    };
  }

  // ------------------------------- delete cust jewellery before after ----------------------------
  async delete(id) {
    // 1. Find document to retrieve Cloudflare R2 image keys before deleting
    const item = await CustJewelleryBeforAfter.findById(id);
    if (!item) {
      throw new ApiError(404, 'Before/After showcase entry not found');
    }

    // 2. Extract image keys
    const keysToDelete = extractImageKeys(item);

    // 3. Hard delete record from MongoDB
    await CustJewelleryBeforAfter.deleteOne({ _id: id });

    // 4. Delete corresponding image files from Cloudflare R2
    await deleteR2Files(keysToDelete);

    return { message: 'Before/After showcase entry hard deleted successfully', id };
  }
}

module.exports = new CustJewelleryBeforeAfterService();
