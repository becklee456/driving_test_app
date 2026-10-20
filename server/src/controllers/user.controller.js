import mongoose from 'mongoose';
import { User, Notification } from '../models/index.js';
import * as authService from '../services/auth.service.js';
import { resetUserProgress } from '../services/progress.service.js';
import { getLeaderboard } from '../services/stats.service.js';
import { getAccessState } from '../services/entitlement.service.js';
import { effectivePermissions, ROLES } from '../constants/permissions.js';
import { success } from '../middleware/error.js';
import { clearAuthCookies } from '../middleware/auth.js';
import { recordActivity } from '../middleware/audit.js';
import ApiError from '../utils/api-error.js';
import { escapeRegex, parsePagination } from '../utils/pagination.js';

function presentUser(user) {
  return {
    ...user.toJSON(),
    permissions: effectivePermissions(user),
  };
}

/* ------------------------------------------------------------------ *
 * Current user
 * ------------------------------------------------------------------ */
export async function getMe(req, res) {
  const [unreadNotifications, access] = await Promise.all([
    Notification.countDocuments({ user: req.user._id, read: false }),
    getAccessState(req.user._id),
  ]);
  return success(res, { user: presentUser(req.user), unreadNotifications, access });
}

export async function updateMe(req, res) {
  const { fullName, phone, preferences, notificationPreferences } = req.body;
  if (fullName !== undefined) req.user.fullName = fullName;
  if (phone !== undefined) req.user.phone = phone || null;
  if (preferences) {
    req.user.preferences = { ...req.user.preferences.toObject?.() ?? req.user.preferences, ...preferences };
  }
  if (notificationPreferences) {
    req.user.notificationPreferences = {
      ...(req.user.notificationPreferences.toObject?.() ?? req.user.notificationPreferences),
      ...notificationPreferences,
    };
  }
  await req.user.save();
  return success(res, { user: presentUser(req.user) });
}

export async function deleteMe(req, res) {
  req.user.status = 'deactivated';
  await req.user.save();
  await authService.revokeAllSessions(req.user._id, 'account_deactivated');
  clearAuthCookies(res);
  await recordActivity(req, { action: 'account.deactivate', resource: 'user', resourceId: req.user._id });
  return success(res, { deactivated: true });
}

/* ------------------------------------------------------------------ *
 * Sessions
 * ------------------------------------------------------------------ */
export async function listSessions(req, res) {
  const sessions = await authService.listSessions(req.user._id);
  return success(res, { sessions });
}

export async function revokeSession(req, res) {
  await authService.revokeSession(req.user._id, req.params.id);
  return success(res, { revoked: true });
}

export async function revokeAllSessions(req, res) {
  const count = await authService.revokeAllSessions(req.user._id, 'revoked_by_user');
  clearAuthCookies(res);
  return success(res, { revoked: count });
}

/* ------------------------------------------------------------------ *
 * Two-factor authentication
 * ------------------------------------------------------------------ */
export async function setupTwoFactor(req, res) {
  const result = await authService.begin2faSetup(req.user);
  return success(res, result);
}

export async function enableTwoFactor(req, res) {
  const result = await authService.enable2fa(req.user, req.body.code);
  await recordActivity(req, { action: 'auth.2fa_enabled', resource: 'user', resourceId: req.user._id });
  return success(res, result);
}

export async function disableTwoFactor(req, res) {
  const result = await authService.disable2fa(req.user, req.body);
  await recordActivity(req, { action: 'auth.2fa_disabled', resource: 'user', resourceId: req.user._id });
  return success(res, { user: presentUser(result.user) });
}

/* ------------------------------------------------------------------ *
 * Admin: user management
 * ------------------------------------------------------------------ */
export async function listUsers(req, res) {
  const { page, limit, skip } = parsePagination(req.validatedQuery || req.query, { defaultLimit: 20, maxLimit: 100 });
  const filter = {};
  const { search, role, status } = req.validatedQuery || req.query;
  if (role && role !== 'all') filter.role = role;
  if (status && status !== 'all') filter.status = status;
  if (search) {
    const re = new RegExp(escapeRegex(String(search).trim()), 'i');
    filter.$or = [{ fullName: re }, { email: re }, { phone: re }];
  }

  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  return success(res, items.map(presentUser), 200, { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
}

export async function getUser(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest('Indangamuntu itariyo', 'INVALID_ID');
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('Nta konti ibonetse', 'USER_NOT_FOUND');
  return success(res, { user: presentUser(user) });
}

export async function updateUser(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest('Indangamuntu itariyo', 'INVALID_ID');
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('Nta konti ibonetse', 'USER_NOT_FOUND');

  const { fullName, phone, role, status, permissions, notes } = req.body;

  if (role !== undefined && role !== user.role) {
    if (user._id.equals(req.user._id)) throw ApiError.badRequest('Ntushobora guhindura uruhare rwawe bwite', 'CANNOT_CHANGE_OWN_ROLE');
    user.role = role;
    user.permissions = [];
  }
  if (permissions !== undefined) user.permissions = permissions;
  if (fullName !== undefined) user.fullName = fullName;
  if (phone !== undefined) user.phone = phone || null;
  if (notes !== undefined) user.notes = notes;
  if (status !== undefined) {
    if (user._id.equals(req.user._id) && status !== 'active') {
      throw ApiError.badRequest('Ntushobora guhagarika konti yawe bwite', 'CANNOT_SUSPEND_SELF');
    }
    user.status = status;
    if (status !== 'active') await authService.revokeAllSessions(user._id, `status_${status}`);
  }
  await user.save();

  await recordActivity(req, {
    action: 'user.update',
    resource: 'user',
    resourceId: user._id,
    meta: { role, status, permissions },
  });
  return success(res, { user: presentUser(user) });
}

export async function suspendUser(req, res) {
  req.body.status = 'suspended';
  return updateUser(req, res);
}

export async function activateUser(req, res) {
  req.body.status = 'active';
  return updateUser(req, res);
}

export async function deleteUser(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest('Indangamuntu itariyo', 'INVALID_ID');
  if (String(req.params.id) === String(req.user._id)) throw ApiError.badRequest('Ntushobora gusiba konti yawe', 'CANNOT_DELETE_SELF');
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('Nta konti ibonetse', 'USER_NOT_FOUND');
  if (user.role === ROLES.SUPER_ADMIN) throw ApiError.forbidden('Ntushobora gusiba umuyobozi mukuru', 'CANNOT_DELETE_SUPER_ADMIN');

  user.status = 'deactivated';
  user.email = `deleted+${user._id}@ikizamini.rw`;
  user.notes = `${user.notes || ''}\n[deleted by ${req.user.email} at ${new Date().toISOString()}]`;
  await user.save();
  await authService.revokeAllSessions(user._id, 'account_deleted');

  await recordActivity(req, { action: 'user.delete', resource: 'user', resourceId: user._id, meta: { email: user.email } });
  return success(res, { deleted: true });
}

export async function resetProgress(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest('Indangamuntu itariyo', 'INVALID_ID');
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('Nta konti ibonetse', 'USER_NOT_FOUND');
  await resetUserProgress(user);
  await recordActivity(req, { action: 'user.reset_progress', resource: 'user', resourceId: user._id });
  return success(res, { reset: true });
}

export async function leaderboard(req, res) {
  const limit = Number(req.validatedQuery?.limit || req.query.limit || 20);
  const users = await getLeaderboard({ limit });
  return success(res, { leaderboard: users });
}

export default {
  getMe,
  updateMe,
  deleteMe,
  listSessions,
  revokeSession,
  revokeAllSessions,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  listUsers,
  getUser,
  updateUser,
  suspendUser,
  activateUser,
  deleteUser,
  resetProgress,
  leaderboard,
};
