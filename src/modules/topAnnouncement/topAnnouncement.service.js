const { TopAnnouncement, TopAnnouncementSetting } = require('./topAnnouncement.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class TopAnnouncementService {
  // ─── Global Settings ───────────────────────────────────────
  async getSettings() {
    let settings = await TopAnnouncementSetting.findOne({ 'meta.deletedAt': null });
    if (!settings) {
      settings = await TopAnnouncementSetting.create({
        isEnabled: true,
        autoplayInterval: 4000,
      });
    }
    return settings;
  }

  async updateSettings(data) {
    let settings = await TopAnnouncementSetting.findOne({ 'meta.deletedAt': null });
    if (!settings) {
      settings = await TopAnnouncementSetting.create({
        isEnabled: data.isEnabled !== undefined ? Boolean(data.isEnabled) : true,
        autoplayInterval: data.autoplayInterval || 4000,
      });
    } else {
      if (data.isEnabled !== undefined) settings.isEnabled = Boolean(data.isEnabled);
      if (data.autoplayInterval !== undefined) settings.autoplayInterval = Number(data.autoplayInterval);
      await settings.save();
    }
    return settings;
  }

  // ─── Get All (Admin) ───────────────────────────────────────
  async getAll(queryParams = {}) {

    const { page, limit, skip } = getPagination(queryParams);
    const filter = { 'meta.deletedAt': null };

    if (queryParams.isActive !== undefined && queryParams.isActive !== '' && queryParams.isActive !== 'all') {
      filter.isActive = queryParams.isActive === 'true' || queryParams.isActive === true;
    }

    if (queryParams.search) {
      const q = queryParams.search.trim();
      filter.$or = [
        { message: new RegExp(q, 'i') },
        { link: new RegExp(q, 'i') },
      ];
    }

    const [items, total, settings] = await Promise.all([
      TopAnnouncement.find(filter)
        .sort({ order: 1, 'meta.createdAt': 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TopAnnouncement.countDocuments(filter),
      this.getSettings(),
    ]);

    return {
      items,
      pagination: getPaginationMeta(total, page, limit),
      settings,
    };
  }

  // ─── Get Public (Storefront Website) ───────────────────────
  async getPublic() {
    const settings = await this.getSettings();
    if (!settings.isEnabled) {
      return {
        isEnabled: false,
        items: [],
      };
    }

    const now = new Date();
    // Query active items where schedule conditions are met
    const filter = {
      'meta.deletedAt': null, isActive: true,
      $and: [
        {
          $or: [
            { startDate: null },
            { startDate: { $lte: now } },
          ],
        },
        {
          $or: [
            { hasNoEndDate: true },
            { endDate: null },
            { endDate: { $gte: now } },
          ],
        },
      ],
    };

    let items = await TopAnnouncement.find(filter)
      .sort({ order: 1, 'meta.createdAt': 1 })
      .select('_id message link order startDate endDate hasNoEndDate')
      .lean();


    return {
      isEnabled: settings.isEnabled,
      autoplayInterval: settings.autoplayInterval || 4000,
      items,
    };
  }

  // ─── Get Single Announcement ──────────────────────────────
  async getOne(id) {
    const item = await TopAnnouncement.findOne({ _id: id });
    if (!item) {
      throw new ApiError(404, 'Announcement not found');
    }
    return item;
  }

  // ─── Create Announcement ───────────────────────────────────
  async create(data) {
    let order = data.order;
    if (order === undefined || order === null) {
      const highestItem = await TopAnnouncement.findOne({ 'meta.deletedAt': null }).sort({ order: -1 }).select('order');
      order = (highestItem?.order || 0) + 1;
    }

    const announcement = await TopAnnouncement.create({
      message: data.message,
      link: data.link || '',
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      order: Number(order),
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      endDate: data.hasNoEndDate ? null : (data.endDate ? new Date(data.endDate) : null),
      hasNoEndDate: data.hasNoEndDate !== undefined ? Boolean(data.hasNoEndDate) : true,
    });

    return announcement;
  }

  // ─── Update Announcement ───────────────────────────────────
  async update(id, data) {
    const updatePayload = {};
    if (data.message !== undefined) updatePayload.message = data.message;
    if (data.link !== undefined) updatePayload.link = data.link;
    if (data.isActive !== undefined) updatePayload.isActive = Boolean(data.isActive);
    if (data.order !== undefined) updatePayload.order = Number(data.order);
    if (data.startDate !== undefined) updatePayload.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.hasNoEndDate !== undefined) {
      updatePayload.hasNoEndDate = Boolean(data.hasNoEndDate);
      if (updatePayload.hasNoEndDate) {
        updatePayload.endDate = null;
      } else if (data.endDate !== undefined) {
        updatePayload.endDate = data.endDate ? new Date(data.endDate) : null;
      }
    } else if (data.endDate !== undefined) {
      updatePayload.endDate = data.endDate ? new Date(data.endDate) : null;
    }

    const item = await TopAnnouncement.findOneAndUpdate(
      { _id: id },
      { $set: updatePayload },
      { returnDocument: 'after', runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Announcement not found');
    }

    return item;
  }

  // ─── Toggle Status ─────────────────────────────────────────
  async toggleStatus(id) {
    const item = await TopAnnouncement.findOne({ _id: id });
    if (!item) {
      throw new ApiError(404, 'Announcement not found');
    }
    item.isActive = !item.isActive;
    await item.save();
    return item;
  }

  // ─── Duplicate Announcement ────────────────────────────────
  async duplicate(id) {
    const source = await TopAnnouncement.findOne({ _id: id });
    if (!source) {
      throw new ApiError(404, 'Announcement not found');
    }

    const highestItem = await TopAnnouncement.findOne({ 'meta.deletedAt': null }).sort({ order: -1 }).select('order');
    const newOrder = (highestItem?.order || 0) + 1;

    const duplicated = await TopAnnouncement.create({
      message: source.message,
      link: source.link,
      isActive: source.isActive,
      order: newOrder,
      startDate: source.startDate || new Date(),
      endDate: source.endDate,
      hasNoEndDate: source.hasNoEndDate,
    });

    return duplicated;
  }

  // ─── Reorder Announcements (Drag and drop) ─────────────────
  async reorder(items) {
    if (!Array.isArray(items)) {
      throw new ApiError(400, 'Items array is required for reordering');
    }

    const bulkOps = items.map((item, index) => ({
      updateOne: {
        filter: { _id: item.id || item._id },
        update: {
          $set: {
            order: typeof item.order === 'number' ? item.order : index + 1,
          },
        },
      },
    }));

    if (bulkOps.length > 0) {
      await TopAnnouncement.bulkWrite(bulkOps);
    }

    return { success: true };
  }

  // ─── Delete Announcement (Soft delete) ─────────────────────
  async delete(id) {
    const item = await TopAnnouncement.findOneAndUpdate(
      { _id: id },
      { $set: { 'meta.deletedAt': new Date() } },
      { returnDocument: 'after' }
    );

    if (!item) {
      throw new ApiError(404, 'Announcement not found');
    }

    return { id, message: 'Announcement deleted successfully' };
  }
}

module.exports = new TopAnnouncementService();
