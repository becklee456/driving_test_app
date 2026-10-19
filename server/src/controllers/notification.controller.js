import * as notificationService from '../services/notification.service.js';
import { success } from '../middleware/error.js';
import ApiError from '../utils/api-error.js';

export async function listNotifications(req, res) {
  const result = await notificationService.listNotifications(req.user._id, req.validatedQuery || req.query);
  return success(res, result.items, 200, {
    total: result.total,
    unread: result.unread,
    page: result.page,
    limit: result.limit,
    pages: Math.max(1, Math.ceil(result.total / result.limit)),
  });
}

export async function unreadCount(req, res) {
  const result = await notificationService.listNotifications(req.user._id, { limit: 1 });
  return success(res, { unread: result.unread });
}

export async function markRead(req, res) {
  const notification = await notificationService.markRead(req.user._id, req.params.id);
  if (!notification) throw ApiError.notFound('Imenyesha ntiribonetse', 'NOTIFICATION_NOT_FOUND');
  return success(res, { notification });
}

export async function markAllRead(req, res) {
  const count = await notificationService.markAllRead(req.user._id);
  return success(res, { updated: count });
}

export default { listNotifications, unreadCount, markRead, markAllRead };
