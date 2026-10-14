const VTOMaster = require('./vtoMaster.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const { getMediaUrl } = require('../../utils/cloudflareR2');

class VTOMasterService {
  // Helper to format media URLs with Cloudflare R2 signed URL
  async formatMedia(item) {
    if (!item) return item;

    const resolveUrl = async (img) => {
      if (!img) return img;
      const key = img.public_id || img.key;

      if (key) {
        try {
          const downloadUrl = await getMediaUrl(key);
          if (downloadUrl) {
            return {
              ...img,
              url: downloadUrl,
            };
          }
        } catch (err) {
          console.error('[formatMedia] Error generating signed R2 media URL:', err.message);
        }
      }

      let url = img.url || '';
      if (url && typeof url === 'string') {
        const trimmed = url.trim();
        if (trimmed.startsWith('/api/upload/file/')) {
          const extractedKey = trimmed.replace('/api/upload/file/', '');
          try {
            const downloadUrl = await getMediaUrl(extractedKey);
            if (downloadUrl) {
              return { ...img, url: downloadUrl };
            }
          } catch {
            // fallback
          }
        }
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          return { ...img, url: trimmed };
        }
      }

      return img;
    };

    const doc = item.toObject ? item.toObject() : { ...item };
    if (doc.lightImage) doc.lightImage = await resolveUrl(doc.lightImage);
    if (doc.darkImage) doc.darkImage = await resolveUrl(doc.darkImage);
    return doc;
  }

  // ------------------------------- create vto master ----------------------------
  async create(data, req = null) {
    if (data.bodyPart) {
      data.bodyPart = data.bodyPart.toLowerCase().trim();
      const existing = await VTOMaster.findOne({
        bodyPart: data.bodyPart,
        isDeleted: false,
      });
      if (existing) {
        throw new ApiError(
          409,
          `VTO configuration for body part "${data.bodyPart}" already exists`
        );
      }
    }
    const created = await VTOMaster.create(data);
    return await this.formatMedia(created, req);
  }

  // ------------------------------- get one vto master ----------------------------
  async getOne(id, req = null) {
    const item = await VTOMaster.findOne({ _id: id, isDeleted: false }).lean();
    if (!item) {
      throw new ApiError(404, 'VTO configuration not found');
    }
    return await this.formatMedia(item, req);
  }

  // ------------------------------- get vto master by body part ----------------------------
  async getByBodyPart(bodyPart, req = null) {
    const item = await VTOMaster.findOne({
      bodyPart: bodyPart.toLowerCase().trim(),
      isDeleted: false,
    }).lean();
    if (!item) {
      throw new ApiError(404, `VTO configuration for "${bodyPart}" not found`);
    }
    return await this.formatMedia(item, req);
  }

  // ------------------------------- get all vto masters ----------------------------
  async getAll(queryParams = {}, req = null) {
    const { page, limit, skip } = getPagination(queryParams);
    const filter = { isDeleted: false };

    if (queryParams.bodyPart) {
      filter.bodyPart = queryParams.bodyPart.toLowerCase();
    }
    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    const [items, total] = await Promise.all([
      VTOMaster.find(filter)
        .sort({ bodyPart: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      VTOMaster.countDocuments(filter),
    ]);

    const formattedItems = await Promise.all(items.map((item) => this.formatMedia(item, req)));
    return { items: formattedItems, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- get vto master lookup ----------------------------
  async getLookup(queryParams = {}, req = null) {
    const filter = { isDeleted: false, status: 'active' };
    const items = await VTOMaster.find(filter)
      .sort({ bodyPart: 1 })
      .select('_id bodyPart lightImage darkImage status')
      .lean();
    return await Promise.all(items.map((item) => this.formatMedia(item, req)));
  }

  // ------------------------------- update vto master ----------------------------
  async update(id, data, req = null) {
    if (data.bodyPart) {
      data.bodyPart = data.bodyPart.toLowerCase().trim();
      const existing = await VTOMaster.findOne({
        bodyPart: data.bodyPart,
        _id: { $ne: id },
        isDeleted: false,
      });
      if (existing) {
        throw new ApiError(
          409,
          `VTO configuration for body part "${data.bodyPart}" already exists`
        );
      }
    }

    const item = await VTOMaster.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'VTO configuration not found');
    }

    return await this.formatMedia(item, req);
  }

  // ------------------------------- delete vto master ----------------------------
  async delete(id) {
    const item = await VTOMaster.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, status: 'inactive' } },
      { new: true }
    );

    if (!item) {
      throw new ApiError(404, 'VTO configuration not found');
    }

    return { message: 'VTO configuration deleted successfully', id };
  }
}

module.exports = new VTOMasterService();
