const notificationService = require('./notification.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

// ------------------------------- get all notifications ----------------------------
const getAll = catchAsync(async (req, res) => {
  const { notifications, pagination } = await notificationService.getAll(req.user._id, req.query);
  return ApiResponse.paginated(res, notifications, pagination);
});

// ------------------------------- mark notification as read ----------------------------
const markAsRead = catchAsync(async (req, res) => {
  const notification = await notificationService.markAsRead(req.params.id, req.user._id);
  return ApiResponse.success(res, notification, 'Marked as read');
});

// ------------------------------- mark all notifications as read ----------------------------
const markAllAsRead = catchAsync(async (req, res) => {
  await notificationService.markAllAsRead(req.user._id);
  return ApiResponse.success(res, null, 'All notifications marked as read');
});

// ------------------------------- get unread notification count ----------------------------
const getUnreadCount = catchAsync(async (req, res) => {
  const count = await notificationService.getUnreadCount(req.user._id);
  return ApiResponse.success(res, { count });
});

// ------------------------------- delete notification ----------------------------
const remove = catchAsync(async (req, res) => {
  await notificationService.delete(req.params.id, req.user._id);
  return ApiResponse.success(res, null, 'Notification deleted');
});

module.exports = { getAll, markAsRead, markAllAsRead, getUnreadCount, remove };
