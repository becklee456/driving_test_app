import mongoose from 'mongoose';
import { User, UserAnswer, Quiz, Question, Bookmark, Category } from '../models/index.js';
import { rankCategories } from './scoring.service.js';

const TZ = 'Africa/Kigali';
const DAY = 24 * 60 * 60 * 1000;

function toObjectId(id) {
  return new mongoose.Types.ObjectId(String(id));
}

function dayKey(date, tz = TZ) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** Per-category tally built from the learner's answer history. */
async function categoryBreakdown(userId) {
  const rows = await UserAnswer.aggregate([
    { $match: { user: toObjectId(userId) } },
    {
      $group: {
        _id: '$category',
        answered: { $sum: 1 },
        correct: { $sum: { $cond: ['$correct', 1, 0] } },
        questions: { $addToSet: '$question' },
        lastAt: { $max: '$answeredAt' },
      },
    },
  ]);

  const categories = await Category.find().select('name nameEn slug color icon order').lean();
  const byId = new Map(rows.map((r) => [String(r._id), r]));

  return categories
    .map((c) => {
      const stat = byId.get(String(c._id));
      const answered = stat?.answered || 0;
      const correct = stat?.correct || 0;
      return {
        id: c._id,
        name: c.name,
        nameEn: c.nameEn,
        slug: c.slug,
        color: c.color,
        icon: c.icon,
        order: c.order,
        totalQuestions: c.questionCount || 0,
        attempted: stat?.questions?.length || 0,
        answered,
        correct,
        accuracy: answered ? Math.round((correct / answered) * 100) : 0,
        coverage: c.questionCount ? Math.round(((stat?.questions?.length || 0) / c.questionCount) * 100) : 0,
        lastActivityAt: stat?.lastAt || null,
      };
    })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

async function dailyActivity(userId, days = 14) {
  const since = new Date(Date.now() - (days - 1) * DAY);
  since.setHours(0, 0, 0, 0);
  const rows = await UserAnswer.aggregate([
    { $match: { user: toObjectId(userId), answeredAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$answeredAt', timezone: TZ } },
        answered: { $sum: 1 },
        correct: { $sum: { $cond: ['$correct', 1, 0] } },
        seconds: { $sum: { $divide: ['$timeSpentMs', 1000] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const byDay = new Map(rows.map((r) => [r._id, r]));
  const series = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(Date.now() - i * DAY);
    const key = dayKey(date);
    const stat = byDay.get(key);
    series.push({
      date: key,
      answered: stat?.answered || 0,
      correct: stat?.correct || 0,
      minutes: Math.round((stat?.seconds || 0) / 60),
    });
  }
  return series;
}

/** The learner's most recent state per question: mastered vs needs work. */
async function masterySummary(userId) {
  const rows = await UserAnswer.aggregate([
    { $match: { user: toObjectId(userId) } },
    { $sort: { answeredAt: -1 } },
    {
      $group: {
        _id: '$question',
        lastCorrect: { $first: '$correct' },
        attempts: { $sum: 1 },
        lastAt: { $first: '$answeredAt' },
      },
    },
  ]);
  const mastered = rows.filter((r) => r.lastCorrect).length;
  const needsWork = rows.filter((r) => !r.lastCorrect).length;
  return { distinctQuestions: rows.length, mastered, needsWork };
}

export async function getUserProgress(user) {
  const userId = user._id;
  const [totalActive, bookmarksCount, mistakes, activeQuiz, recentQuizzes, categories, activity, mastery] = await Promise.all([
    Question.countDocuments({ status: 'active', examinable: true }),
    Bookmark.countDocuments({ user: userId }),
    UserAnswer.countDocuments({ user: userId, correct: false }),
    Quiz.findOne({ user: userId, status: 'in_progress' }).sort({ createdAt: -1 }).select('type title startedAt expiresAt score questions').lean(),
    Quiz.find({ user: userId, status: 'submitted' })
      .sort({ submittedAt: -1 })
      .limit(5)
      .select('type title score submittedAt durationSec')
      .lean(),
    categoryBreakdown(userId),
    dailyActivity(userId, 14),
    masterySummary(userId),
  ]);

  const stats = user.studyStats || {};
  const accuracy = stats.questionsAttempted ? Math.round((stats.questionsCorrect / stats.questionsAttempted) * 100) : 0;
  const today = dayKey(new Date());
  const todayRow = activity.find((a) => a.date === today);
  const goal = user.preferences?.dailyGoal || 20;

  const byCategory = categories
    .filter((c) => c.answered > 0)
    .map((c) => ({ slug: c.slug, name: c.name, total: c.answered, correct: c.correct }));
  const ranks = rankCategories(byCategory);

  return {
    overview: {
      questionsAttempted: stats.questionsAttempted || 0,
      questionsCorrect: stats.questionsCorrect || 0,
      accuracy,
      testsCompleted: stats.testsCompleted || 0,
      totalStudySeconds: stats.totalStudySeconds || 0,
      bestScore: stats.bestScore || 0,
      lastActiveAt: stats.lastActiveAt || null,
    },
    gamification: {
      xp: user.gamification?.xp || 0,
      level: user.gamification?.level || 1,
      currentStreak: user.gamification?.currentStreak || 0,
      longestStreak: user.gamification?.longestStreak || 0,
      totalStudyDays: user.gamification?.totalStudyDays || 0,
      achievements: (user.achievements || []).length,
    },
    coverage: {
      totalQuestions: totalActive,
      studied: mastery.distinctQuestions,
      mastered: mastery.mastered,
      needsWork: mastery.needsWork,
      mistakes: mistakes,
      bookmarks: bookmarksCount,
      coveragePercent: totalActive ? Math.round((mastery.distinctQuestions / totalActive) * 100) : 0,
    },
    dailyGoal: {
      goal,
      answeredToday: todayRow?.answered || 0,
      percent: Math.min(100, Math.round(((todayRow?.answered || 0) / goal) * 100)),
    },
    categories,
    weakCategories: ranks.weak,
    strongCategories: ranks.strong,
    activity,
    recentQuizzes,
    activeQuiz,
  };
}

export async function getCategoryProgress(user, { categorySlug } = {}) {
  const categories = await categoryBreakdown(user._id);
  if (categorySlug) return categories.find((c) => c.slug === categorySlug) || null;
  return categories;
}

/** Daily counts for the last `days` days, used by the calendar/heatmap view. */
export async function getActivityHeatmap(user, { days = 90 } = {}) {
  const capped = Math.min(Math.max(days, 7), 365);
  return dailyActivity(user._id, capped);
}

export async function getMistakes(user, { limit = 20 } = {}) {
  const rows = await UserAnswer.aggregate([
    { $match: { user: toObjectId(user._id) } },
    { $sort: { answeredAt: -1 } },
    {
      $group: {
        _id: '$question',
        lastCorrect: { $first: '$correct' },
        attempts: { $sum: 1 },
        wrongCount: { $sum: { $cond: ['$correct', 0, 1] } },
        lastSelectedOptionId: { $first: '$selectedOptionId' },
        lastAt: { $first: '$answeredAt' },
      },
    },
    { $match: { lastCorrect: false } },
    { $sort: { wrongCount: -1, lastAt: -1 } },
    { $limit: Math.min(Math.max(limit, 1), 100) },
  ]);

  const questions = await Question.find({ _id: { $in: rows.map((r) => r._id) } })
    .populate('category', 'name slug color')
    .lean();
  const byId = new Map(questions.map((q) => [String(q._id), q]));

  return rows
    .map((r) => {
      const q = byId.get(String(r._id));
      if (!q) return null;
      return {
        question: {
          id: q._id,
          questionNumber: q.questionNumber,
          questionText: q.questionText,
          category: q.category,
          options: q.options.map((o) => ({ id: o.id, label: o.label, text: o.text })),
          explanation: q.explanation,
        },
        attempts: r.attempts,
        wrongCount: r.wrongCount,
        lastSelectedOptionId: r.lastSelectedOptionId,
        correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
        lastAt: r.lastAt,
      };
    })
    .filter(Boolean);
}

export async function resetUserProgress(user) {
  await Promise.all([
    UserAnswer.deleteMany({ user: user._id }),
    Quiz.deleteMany({ user: user._id }),
    Bookmark.deleteMany({ user: user._id }),
  ]);
  const fresh = await User.findById(user._id);
  fresh.studyStats = { questionsAttempted: 0, questionsCorrect: 0, testsCompleted: 0, totalStudySeconds: 0, bestScore: 0, lastActiveAt: null };
  fresh.gamification = { xp: 0, level: 1, currentStreak: 0, longestStreak: 0, lastStudyDate: null, totalStudyDays: 0 };
  fresh.achievements = [];
  await fresh.save();
  return fresh;
}

export default {
  getUserProgress,
  getCategoryProgress,
  getActivityHeatmap,
  getMistakes,
  resetUserProgress,
};
