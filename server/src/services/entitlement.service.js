import mongoose from 'mongoose';
import { Entitlement, Subscription, Settings, Quiz, UserAnswer } from '../models/index.js';
import ApiError from '../utils/api-error.js';

const DEFAULT_FREE_QUESTIONS = 40;
const DEFAULT_FREE_PRACTICE_ATTEMPTS = 1;
const UNLIMITED = -1;

const PRACTICE_LIKE_TYPES = ['practice', 'study', 'category', 'daily'];

/**
 * Loads (creating on first use) the caller's entitlement ledger and syncs the
 * allowance from platform settings. The allowance sync only ever *raises* the
 * ceiling when an admin increases it; it never resets usage.
 */
export async function getEntitlement(userId) {
  const settings = await Settings.getSettings();
  const allowed = Number.isFinite(settings.freeQuestionsAllowed)
    ? settings.freeQuestionsAllowed
    : DEFAULT_FREE_QUESTIONS;
  const attemptsAllowed = Number.isFinite(settings.freePracticeAttemptsAllowed)
    ? settings.freePracticeAttemptsAllowed
    : DEFAULT_FREE_PRACTICE_ATTEMPTS;

  let ent = await Entitlement.findOne({ user: userId });
  if (!ent) {
    ent = await Entitlement.create({
      user: userId,
      freeQuestionsAllowed: allowed,
      freeQuestionsUsed: 0,
      freePracticeAttemptsAllowed: attemptsAllowed,
      freePracticeAttemptsUsed: 0,
      answeredQuestionIds: [],
    });
    return ent;
  }

  let dirty = false;
  if (ent.freeQuestionsAllowed !== allowed) {
    ent.freeQuestionsAllowed = allowed;
    dirty = true;
  }
  if (ent.freePracticeAttemptsAllowed !== attemptsAllowed) {
    ent.freePracticeAttemptsAllowed = attemptsAllowed;
    dirty = true;
  }
  if (dirty) await ent.save();
  return ent;
}

/** Loads the learner's currently active subscription (null when none/expired). */
export async function findActiveSubscription(userId, now = new Date()) {
  return Subscription.findOne({
    user: userId,
    status: 'active',
    $or: [{ isLifetime: true }, { expiresAt: null }, { expiresAt: { $gt: now } }],
  }).sort({ expiresAt: -1, activatedAt: -1 });
}

/** True when the learner currently has an active premium subscription. */
export async function hasActiveSubscription(userId, now = new Date()) {
  const sub = await findActiveSubscription(userId, now);
  return Boolean(sub);
}

/**
 * Computes the learner's access state used by both the API and the UI.
 * Premium learners always report unlimited free-question access; their plan's
 * own entitlement quotas (if any) are exposed via `subscription.entitlements`.
 */
export async function getAccessState(userId) {
  const [ent, subscription] = await Promise.all([
    getEntitlement(userId),
    findActiveSubscription(userId),
  ]);
  const premium = Boolean(subscription);

  const allowed = ent.freeQuestionsAllowed;
  const used = ent.freeQuestionsUsed;
  const attemptsAllowed = ent.freePracticeAttemptsAllowed;
  const attemptsUsed = ent.freePracticeAttemptsUsed;

  return {
    isPremium: premium,
    freeQuestionsAllowed: allowed,
    freeQuestionsUsed: used,
    freeQuestionsRemaining: Math.max(0, allowed - used),
    freePracticeAttemptsAllowed: attemptsAllowed,
    freePracticeAttemptsUsed: attemptsUsed,
    freePracticeAttemptsRemaining: Math.max(0, attemptsAllowed - attemptsUsed),
    questionsLimitReached: !premium && used >= allowed,
    attemptsLimitReached: !premium && attemptsUsed >= attemptsAllowed,
    subscription: subscription
      ? {
          id: subscription._id,
          planCode: subscription.planCode,
          planName: subscription.planName,
          isLifetime: subscription.isLifetime,
          status: subscription.status,
          activatedAt: subscription.activatedAt,
          expiresAt: subscription.expiresAt,
          entitlements: subscription.entitlements || null,
        }
      : null,
  };
}

/** Number of additional distinct questions the learner may still answer for free. */
export function remainingFreeQuestions(ent) {
  return Math.max(0, (ent.freeQuestionsAllowed || 0) - (ent.freeQuestionsUsed || 0));
}

/**
 * Rejects the request when a free learner's question allowance is exhausted.
 * Premium learners are unaffected.
 */
export async function assertCanAttemptQuestions(user, { needed = 1 } = {}) {
  const state = await getAccessState(user._id);
  if (state.isPremium) return state;
  if (state.freeQuestionsRemaining <= 0) {
    throw ApiError.forbidden(
      'Ikizamini cy’ubuntu kirangiye. Kora subscription ya premium kugira ngo ukomeze.',
      'FREE_LIMIT_REACHED',
      { freeQuestionsAllowed: state.freeQuestionsAllowed, freeQuestionsUsed: state.freeQuestionsUsed, needed },
    );
  }
  return state;
}

/**
 * Rejects a premium-only quiz type (mock exams, mistakes review, bookmarks) for
 * free learners. Study/practice flows go through the question allowance instead.
 */
export async function assertPremiumForType(user, type) {
  const premiumOnly = ['mock', 'mistakes', 'bookmarks'];
  if (!premiumOnly.includes(type)) return;
  if (await hasActiveSubscription(user._id)) return;
  throw ApiError.forbidden(
    'Iki gikorwa kirabikwa gusa ku bakoresha premium. Kora subscription ubanze.',
    'PREMIUM_REQUIRED',
    { type },
  );
}

/** Start of the current UTC calendar day (quota windows are UTC days). */
export function startOfUtcDay(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Enforces the plan's daily mock-exam quota for premium learners. Quotas come
 * from the subscription's frozen entitlements snapshot; -1 means unlimited and
 * quotas below 0 are ignored. Free learners never reach this check (mock exams
 * are premium-only).
 */
export async function assertDailyMockQuota(entitlements, userId, now = new Date()) {
  const limit = Number(entitlements?.dailyMockExams);
  if (!Number.isFinite(limit) || limit === UNLIMITED) return;
  if (limit <= 0) {
    throw ApiError.forbidden(
      'Ubwenge bwawe ntibwerera ibizamini by’igerageza. Hindura plan.',
      'MOCK_LIMIT_REACHED',
      { dailyMockExams: 0, used: 0 },
    );
  }
  const used = await Quiz.countDocuments({
    user: userId,
    type: 'mock',
    createdAt: { $gte: startOfUtcDay(now) },
  });
  if (used >= limit) {
    throw ApiError.forbidden(
      'Warakanye ibizamini by’igerageza byemewe uyu munsi. Tegereza ejo hasi.',
      'MOCK_LIMIT_REACHED',
      { dailyMockExams: limit, used },
    );
  }
}

/**
 * Enforces the plan's daily distinct-question quota for premium learners.
 * Free learners are already capped by their lifetime allowance, so this only
 * applies to subscriptions whose entitlements snapshot sets a finite quota.
 */
export async function assertDailyQuestionQuota(entitlements, userId, { needed = 1, now = new Date() } = {}) {
  const limit = Number(entitlements?.dailyQuestions);
  if (!Number.isFinite(limit) || limit === UNLIMITED) return;
  if (limit <= 0) {
    throw ApiError.forbidden(
      'Ubwenge bwawe ntibwerera ibibazo uyu munsi. Hindura plan.',
      'DAILY_QUESTION_LIMIT_REACHED',
      { dailyQuestions: 0, used: 0, needed },
    );
  }
  const rows = await UserAnswer.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(String(userId)), answeredAt: { $gte: startOfUtcDay(now) } } },
    { $group: { _id: '$question' } },
    { $count: 'total' },
  ]);
  const used = rows[0]?.total || 0;
  if (used + needed > limit) {
    throw ApiError.forbidden(
      'Warakanye ibibazo byemewe uyu munsi. Tegereza ejo hasi cyangwa hindura plan.',
      'DAILY_QUESTION_LIMIT_REACHED',
      { dailyQuestions: limit, used, needed },
    );
  }
}

/**
 * Records that a learner has consumed free questions. Called after a quiz is
 * submitted. The distinct-question set makes repeat attempts on the same
 * questions free of additional charge, and makes the count immune to resets.
 */
export async function consumeFreeQuestions(userId, questionIds = []) {
  if (!questionIds.length) return null;
  const ent = await getEntitlement(userId);
  const set = new Set(ent.answeredQuestionIds.map((id) => String(id)));
  const before = set.size;
  for (const id of questionIds) set.add(String(id));
  if (set.size === before) return ent;

  ent.answeredQuestionIds = [...set];
  ent.freeQuestionsUsed = set.size;
  await ent.save();
  return ent;
}

/** Records that a free learner used one of their free practice attempts. */
export async function consumeFreePracticeAttempt(userId) {
  const ent = await getEntitlement(userId);
  ent.freePracticeAttemptsUsed += 1;
  await ent.save();
  return ent;
}

/** Resets a learner's entitlement (admin action / progress reset). */
export async function resetEntitlement(userId) {
  await Entitlement.findOneAndUpdate(
    { user: userId },
    {
      $set: {
        freeQuestionsUsed: 0,
        freePracticeAttemptsUsed: 0,
        answeredQuestionIds: [],
      },
    },
    { upsert: true },
  );
}

export { PRACTICE_LIKE_TYPES };

export default {
  getEntitlement,
  getAccessState,
  hasActiveSubscription,
  findActiveSubscription,
  remainingFreeQuestions,
  assertCanAttemptQuestions,
  assertPremiumForType,
  assertDailyMockQuota,
  assertDailyQuestionQuota,
  consumeFreeQuestions,
  consumeFreePracticeAttempt,
  resetEntitlement,
};
