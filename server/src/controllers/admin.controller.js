import { Settings, AdminActivity } from '../models/index.js';
import * as statsService from '../services/stats.service.js';
import { invalidateSettingsCache } from '../middleware/settings.js';
import { success } from '../middleware/error.js';
import { recordActivity } from '../middleware/audit.js';
import { parsePagination } from '../utils/pagination.js';

/* ------------------------------------------------------------------ *
 * Analytics
 * ------------------------------------------------------------------ */
export async function overview(req, res) {
  return success(res, await statsService.getOverview());
}

export async function userGrowth(req, res) {
  const days = Number(req.query.days) || 30;
  return success(res, { series: await statsService.getUserGrowth({ days }) });
}

export async function activityTrend(req, res) {
  const days = Number(req.query.days) || 30;
  return success(res, { series: await statsService.getActivityTrend({ days }) });
}

export async function categoryPerformance(req, res) {
  return success(res, { categories: await statsService.getCategoryPerformance() });
}

export async function questionInsights(req, res) {
  const limit = Number(req.query.limit) || 15;
  return success(res, await statsService.getQuestionInsights({ limit }));
}

export async function reviewQueue(req, res) {
  const { page, limit } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
  return success(res, await statsService.getReviewQueue({ page, limit }));
}

export async function leaderboard(req, res) {
  const limit = Number(req.query.limit) || 20;
  return success(res, { leaderboard: await statsService.getLeaderboard({ limit }) });
}

export async function recentActivity(req, res) {
  const limit = Number(req.query.limit) || 30;
  return success(res, { activity: await statsService.getRecentActivity({ limit }) });
}

/* ------------------------------------------------------------------ *
 * Audit trail
 * ------------------------------------------------------------------ */
export async function listAudit(req, res) {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 30, maxLimit: 100 });
  const filter = {};
  if (req.query.action) filter.action = req.query.action;
  if (req.query.actor) filter.actor = req.query.actor;
  if (req.query.result && req.query.result !== 'all') filter.result = req.query.result;

  const [items, total] = await Promise.all([
    AdminActivity.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('actor', 'fullName email role')
      .lean(),
    AdminActivity.countDocuments(filter),
  ]);
  return success(res, items, 200, { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
}

/* ------------------------------------------------------------------ *
 * Platform settings
 * ------------------------------------------------------------------ */
export async function getSettings(req, res) {
  const settings = await Settings.getSettings();
  return success(res, { settings });
}

export async function updateSettings(req, res) {
  const settings = await Settings.getSettings();
  const allowed = [
    'passingScorePercent',
    'examQuestionCount',
    'examDurationMinutes',
    'practiceDefaultCount',
    'allowRegistration',
    'requireEmailVerification',
    'require2FAForAdmins',
    'allowSelfServiceReset',
    'maintenanceMode',
    'defaultLanguage',
    'enabledLanguages',
    'announcement',
    'xpPerCorrectAnswer',
    'xpPerTest',
  ];
  for (const key of allowed) {
    if (req.body[key] !== undefined) settings[key] = req.body[key];
  }
  if (req.body.theme && typeof req.body.theme === 'object') {
    settings.theme = { ...(settings.theme || {}), ...req.body.theme };
  }
  settings.updatedBy = req.user._id;
  await settings.save();
  invalidateSettingsCache();

  await recordActivity(req, { action: 'settings.update', resource: 'settings', meta: { keys: Object.keys(req.body) } });
  return success(res, { settings });
}

export async function updatePaymentSettings(req, res) {
  const settings = await Settings.getSettings();
  const { freeQuestionsAllowed, freePracticeAttemptsAllowed, payment } = req.body || {};
  if (freeQuestionsAllowed !== undefined) settings.freeQuestionsAllowed = freeQuestionsAllowed;
  if (freePracticeAttemptsAllowed !== undefined) settings.freePracticeAttemptsAllowed = freePracticeAttemptsAllowed;
  if (payment && typeof payment === 'object') {
    settings.payment = { ...(settings.payment || {}), ...payment };
  }
  settings.updatedBy = req.user._id;
  await settings.save();
  invalidateSettingsCache();

  await recordActivity(req, { action: 'settings.update_payment', resource: 'settings', meta: { keys: Object.keys(req.body) } });
  return success(res, { settings });
}

export default {
  overview,
  userGrowth,
  activityTrend,
  categoryPerformance,
  questionInsights,
  reviewQueue,
  leaderboard,
  recentActivity,
  listAudit,
  getSettings,
  updateSettings,
  updatePaymentSettings,
};
