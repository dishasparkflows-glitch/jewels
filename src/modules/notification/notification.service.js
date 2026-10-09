const Notification = require('./notification.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class NotificationService {
  // ------------------------------- get all notifications ----------------------------
  async getAll(userId, query) {
    const { page, limit, skip } = getPagination(query);
    const filter = { userId };
    if (query.isRead !== undefined) filter.isRead = query.isRead === 'true';

    const [notifications, total] = await Promise.all([
      Notification.find(filter).sort({ 'meta.createdAt': -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
    ]);

    return { notifications, pagination: getPaginationMeta(total, page, limit) };
  }

  // ------------------------------- create notification ----------------------------
  async create(data) {
    return Notification.create(data);
  }

  // ------------------------------- mark notification as read ----------------------------
  async markAsRead(id, userId) {
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    if (!notification) throw new ApiError(404, 'Notification not found');
    return notification;
  }

  // ------------------------------- mark all notifications as read ----------------------------
  async markAllAsRead(userId) {
    return Notification.updateMany({ userId, isRead: false }, { isRead: true, readAt: new Date() });
  }

  // ------------------------------- get unread notification count ----------------------------
  async getUnreadCount(userId) {
    return Notification.countDocuments({ userId, isRead: false });
  }

  // ------------------------------- delete notification ----------------------------
  async delete(id, userId) {
    const notification = await Notification.findOneAndDelete({ _id: id, userId });
    if (!notification) throw new ApiError(404, 'Notification not found');
    return notification;
  }
}

module.exports = new NotificationService();
