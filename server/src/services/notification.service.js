import { Notification } from '../models/index.js';
import { parsePagination } from '../utils/pagination.js';

/** Maps notification types to the user preference that can silence them. */
const PREFERENCE_BY_TYPE = {
  study_reminder: 'studyReminders',
  new_content: 'newContent',
  achievement: 'achievements',
  test_result: 'testResults',
  security: 'securityAlerts',
};

export async function notify(user, { type = 'system', title, body = '', data = {} }) {
  const prefKey = PREFERENCE_BY_TYPE[type];
  if (prefKey && user?.notificationPreferences && user.notificationPreferences[prefKey] === false) {
    return null;
  }
  return Notification.create({ user: user._id || user, type, title, body, data });
}

export async function notifyMany(userIds, payload) {
  if (!userIds?.length) return [];
  return Notification.insertMany(userIds.map((user) => ({ user, ...payload })));
}

export async function listNotifications(userId, query = {}) {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 20, maxLimit: 50 });
  const filter = { user: userId };
  if (query.unread === 'true') filter.read = false;
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: userId, read: false }),
  ]);
  return { items, total, unread, page, limit };
}

export async function markRead(userId, id) {
  return Notification.findOneAndUpdate(
    { _id: id, user: userId },
    { read: true, readAt: new Date() },
    { new: true },
  );
}

export async function markAllRead(userId) {
  const res = await Notification.updateMany(
    { user: userId, read: false },
    { read: true, readAt: new Date() },
  );
  return res.modifiedCount;
}

export default { notify, notifyMany, listNotifications, markRead, markAllRead };
