const Notification = require('./notification.model');
const User = require('../user/user.model');
const { ROLES } = require('../../config/constants');
const { escapeRegex } = require('../../utils/string');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class NotificationService {
  // ------------------------------- get all notifications ----------------------------
  async getAll(userId, query = {}) {
    const { page, limit, skip } = getPagination(query);
    const filter = { userId };

    if (query.isRead === 'true' || query.isRead === 'false') {
      filter.isRead = query.isRead === 'true';
    }

    if (query.type && ['info', 'success', 'warning', 'error'].includes(query.type)) {
      filter.type = query.type;
    }

    if (query.search && String(query.search).trim()) {
      const rx = new RegExp(escapeRegex(String(query.search).trim()), 'i');
      filter.$or = [
        { title: rx },
        { message: rx },
        { 'metadata.customerName': rx },
        { 'metadata.email': rx },
        { 'metadata.phone': rx },
      ];
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ sendAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId, isRead: { $ne: true } }),
    ]);

    return { notifications, unreadCount, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- create notification ----------------------------
  async create(data) {
    if (!data.sendAt) data.sendAt = new Date();
    return Notification.create(data);
  }

  // ------------------------------- notify all active admins ----------------------------
  async notifyAdmins({ title, message, type = 'info', metadata = {} }) {
    const admins = await User.find({
      role: { $in: [ROLES.SUPER_ADMIN, ROLES.ADMIN] },
      isActive: true,
      'meta.deletedAt': null,
    })
      .select('_id')
      .lean();

    if (!admins.length) return [];

    const now = new Date();
    const docs = admins.map((admin) => ({
      title,
      message,
      type,
      userId: admin._id,
      isRead: false,
      sendAt: now,
      metadata,
    }));

    return Notification.insertMany(docs);
  }

  // ------------------------------- mark notification as read ----------------------------
  async markAsRead(id, userId) {
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { isRead: true, readAt: new Date() },
      { returnDocument: 'after' }
    );
    if (!notification) throw new ApiError(404, 'Notification not found');
    return notification;
  }

  // ------------------------------- mark all notifications as read ----------------------------
  async markAllAsRead(userId) {
    return Notification.updateMany(
      { userId, isRead: { $ne: true } },
      { isRead: true, readAt: new Date() }
    );
  }

  // ------------------------------- get unread notification count ----------------------------
  async getUnreadCount(userId) {
    return Notification.countDocuments({ userId, isRead: { $ne: true } });
  }

  // ------------------------------- delete notification ----------------------------
  async delete(id, userId) {
    const notification = await Notification.findOneAndDelete({ _id: id, userId });
    if (!notification) throw new ApiError(404, 'Notification not found');
    return notification;
  }

  // ------------------------------- bulk delete notifications ----------------------------
  async bulkDelete(ids, userId) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, 'Please provide notification IDs to delete');
    }
    const result = await Notification.deleteMany({ _id: { $in: ids }, userId });
    return { deletedCount: result.deletedCount || 0 };
  }
}

module.exports = new NotificationService();
