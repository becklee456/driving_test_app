import { Achievement, Bookmark, Quiz, UserAnswer } from '../models/index.js';
import Notification from '../models/notification.model.js';
import logger from '../config/logger.js';

const XP_PER_LEVEL = 200;

export function levelForXp(xp = 0) {
  return Math.max(1, 1 + Math.floor(xp / XP_PER_LEVEL));
}

export function xpForNextLevel(xp = 0) {
  const level = levelForXp(xp);
  return level * XP_PER_LEVEL - xp;
}

/** Updates the daily study streak based on the current calendar day. */
export function touchStreak(user, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const g = user.gamification;
  if (g.lastStudyDate === today) return false;

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (g.lastStudyDate === yesterday) g.currentStreak += 1;
  else g.currentStreak = 1;

  g.lastStudyDate = today;
  g.totalStudyDays += 1;
  g.longestStreak = Math.max(g.longestStreak, g.currentStreak);
  return true;
}

export async function addXp(user, amount) {
  if (!amount) return;
  user.gamification.xp = Math.max(0, (user.gamification.xp || 0) + amount);
  user.gamification.level = levelForXp(user.gamification.xp);
}

export async function collectMetrics(userId) {
  const [distinctStudied, answers, correct, tests, bookmarks, perfect, missedReviewed] = await Promise.all([
    UserAnswer.distinct('question', { user: userId }).then((r) => r.length),
    UserAnswer.countDocuments({ user: userId }),
    UserAnswer.countDocuments({ user: userId, correct: true }),
    Quiz.countDocuments({ user: userId, status: 'submitted', type: { $in: ['mock', 'practice', 'category', 'daily'] } }),
    Bookmark.countDocuments({ user: userId }),
    Quiz.countDocuments({ user: userId, status: 'submitted', 'score.percentage': 100 }),
    UserAnswer.countDocuments({ user: userId, correct: true, quizType: 'mistakes' }),
  ]);

  return {
    questions_studied: distinctStudied,
    questions_answered: answers,
    questions_correct: correct,
    accuracy: answers ? Math.round((correct / answers) * 100) : 0,
    tests_completed: tests,
    perfect_score: perfect,
    bookmarks_created: bookmarks,
    mistakes_reviewed: missedReviewed,
  };
}

/**
 * Evaluates achievement definitions against a user's metrics and unlocks the
 * ones that are met. Returns the newly unlocked achievement documents.
 */
export async function evaluateAchievements(user) {
  const definitions = await Achievement.find({ isActive: true }).lean();
  if (!definitions.length) return [];

  const metrics = await collectMetrics(user._id);
  const unlockedCodes = new Set((user.achievements || []).map((a) => a.code));
  const newlyUnlocked = [];
  let xpGained = 0;

  for (const def of definitions) {
    if (unlockedCodes.has(def.code)) continue;
    const value = metrics[def.criteria?.type];
    if (typeof value !== 'number') continue;
    const meets = def.criteria.type === 'streak_days'
      ? (user.gamification.currentStreak || 0) >= def.criteria.threshold
      : value >= def.criteria.threshold;
    if (!meets) continue;

    user.achievements.push({ code: def.code, unlockedAt: new Date(), seen: false });
    newlyUnlocked.push(def);
    xpGained += def.xp || 0;
    unlockedCodes.add(def.code);
  }

  if (newlyUnlocked.length) {
    await addXp(user, xpGained);
    await user.save();
    await Promise.all(
      newlyUnlocked.map((def) =>
        Notification.create({
          user: user._id,
          type: 'achievement',
          title: `Urakoze! Watsindiye: ${def.title}`,
          body: def.description || '',
          data: { achievementCode: def.code, xp: def.xp },
        }),
      ),
    );
    logger.debug('Achievements unlocked', { user: user._id, codes: newlyUnlocked.map((d) => d.code) });
  }

  return newlyUnlocked;
}

export default { evaluateAchievements, collectMetrics, addXp, touchStreak, levelForXp, xpForNextLevel };
