const { TopAnnouncement, TopAnnouncementSetting } = require('./topAnnouncement.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class TopAnnouncementService {
  // ------------------------------- get announcement settings ----------------------------
  async getSettings() {
    let settings = await TopAnnouncementSetting.findOne({ 'meta.deletedAt': null });
    if (!settings) {
      settings = await TopAnnouncementSetting.create({
        isEnabled: true,
        autoplayInterval: 4000,
        displayDirection: 'horizontal',
      });
    }
    return settings;
  }

  // ------------------------------- update announcement settings ----------------------------
  async updateSettings(data) {
    let settings = await TopAnnouncementSetting.findOne({ 'meta.deletedAt': null });
    if (!settings) {
      settings = await TopAnnouncementSetting.create(data);
    } else {
      Object.assign(settings, data);
      await settings.save();
    }
    return settings;
  }

  // ------------------------------- get all announcements (Admin) ----------------------------
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

  // ------------------------------- get public announcements (Storefront) ----------------------------
  async getPublic() {
    const settings = await this.getSettings();
    if (!settings.isEnabled) {
      return {
        isEnabled: false,
        items: [],
      };
    }

    const now = new Date();
    const filter = {
      'meta.deletedAt': null,
      isActive: true,
      $and: [
        {
          $or: [
            { 'date.start': null },
            { 'date.start': { $lte: now } },
          ],
        },
        {
          $or: [
            { hasNoEndDate: true },
            { 'date.end': null },
            { 'date.end': { $gte: now } },
          ],
        },
      ],
    };

    const items = await TopAnnouncement.find(filter)
      .sort({ order: 1, 'meta.createdAt': 1 })
      .select('_id message link order date hasNoEndDate')
      .lean();

    return {
      isEnabled: settings.isEnabled,
      autoplayInterval: settings.autoplayInterval || 4000,
      displayDirection: settings.displayDirection || 'horizontal',
      items,
    };
  }

  // ------------------------------- get single announcement ----------------------------
  async getOne(id) {
    const item = await TopAnnouncement.findOne({ _id: id });
    if (!item) {
      throw new ApiError(404, 'Announcement not found');
    }
    return item;
  }

  // ------------------------------- create announcement ----------------------------
  async create(data) {
    if (data.order === undefined || data.order === null) {
      const highestItem = await TopAnnouncement.findOne({ 'meta.deletedAt': null }).sort({ order: -1 }).select('order');
      data.order = (highestItem?.order || 0) + 1;
    }

    const announcement = await TopAnnouncement.create(data);
    return announcement;
  }

  // ------------------------------- update announcement ----------------------------
  async update(id, data) {
    const item = await TopAnnouncement.findOneAndUpdate(
      { _id: id },
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    );

    if (!item) {
      throw new ApiError(404, 'Announcement not found');
    }

    return item;
  }

  // ------------------------------- toggle announcement status ----------------------------
  async toggleStatus(id) {
    const item = await TopAnnouncement.findOne({ _id: id });
    if (!item) {
      throw new ApiError(404, 'Announcement not found');
    }
    item.isActive = !item.isActive;
    await item.save();
    return item;
  }

  // ------------------------------- duplicate announcement ----------------------------
  async duplicate(id) {
    const source = await TopAnnouncement.findOne({ _id: id }).lean();
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
      date: source.date,
      hasNoEndDate: source.hasNoEndDate,
    });

    return duplicated;
  }

  // ------------------------------- reorder announcements ----------------------------
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

  // ------------------------------- delete announcement (Soft delete) ----------------------------
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
