import { User, UserAnswer, Quiz, Question, Category, QuestionReport, Bookmark, AdminActivity } from '../models/index.js';

const TZ = 'Africa/Kigali';
const DAY = 24 * 60 * 60 * 1000;

function daysAgo(n) {
  const d = new Date(Date.now() - n * DAY);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dailySeries(rows, days) {
  const map = new Map(rows.map((r) => [r._id, r]));
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(Date.now() - i * DAY);
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date);
    const row = map.get(key);
    out.push({ date: key, ...(row ? row : {}) , _id: undefined });
  }
  return out;
}

function countByDay(model, dateField, days, extraMatch = {}) {
  return model.aggregate([
    { $match: { [dateField]: { $gte: daysAgo(days - 1) }, ...extraMatch } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: `$${dateField}`, timezone: TZ } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

export async function getOverview() {
  const [totalUsers, newToday, newWeek, newMonth, activeWeek, activeMonth] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: daysAgo(0) } }),
    User.countDocuments({ createdAt: { $gte: daysAgo(6) } }),
    User.countDocuments({ createdAt: { $gte: daysAgo(29) } }),
    User.countDocuments({ 'studyStats.lastActiveAt': { $gte: daysAgo(6) } }),
    User.countDocuments({ 'studyStats.lastActiveAt': { $gte: daysAgo(29) } }),
  ]);

  const [questionsTotal, questionsActive, questionsReview, questionsNeedsReview, questionsMissingAnswer] = await Promise.all([
    Question.countDocuments(),
    Question.countDocuments({ status: 'active' }),
    Question.countDocuments({ status: 'review' }),
    Question.countDocuments({ needsReview: true }),
    Question.countDocuments({ status: { $ne: 'inactive' }, examinable: false }),
  ]);

  const [categories, quizzesTotal, mockAttempts, reportsOpen, bookmarks] = await Promise.all([
    Category.countDocuments({ isActive: true }),
    Quiz.countDocuments({ status: 'submitted' }),
    Quiz.countDocuments({ type: 'mock', status: 'submitted' }),
    UserAnswer.countDocuments(),
    QuestionReport.countDocuments({ status: { $in: ['pending', 'under_review'] } }),
    Bookmark.countDocuments(),
  ]);

  const scoreAgg = await Quiz.aggregate([
    { $match: { status: 'submitted', 'score.total': { $gt: 0 } } },
    {
      $group: {
        _id: null,
        avgScore: { $avg: '$score.percentage' },
        avgDuration: { $avg: '$durationSec' },
        passed: { $sum: { $cond: ['$score.passed', 1, 0] } },
        total: { $sum: 1 },
      },
    },
  ]);
  const scores = scoreAgg[0] || { avgScore: 0, avgDuration: 0, passed: 0, total: 0 };

  const answeredAgg = await UserAnswer.aggregate([
    { $group: { _id: null, total: { $sum: 1 }, correct: { $sum: { $cond: ['$correct', 1, 0] } } } },
  ]);
  const answered = answeredAgg[0] || { total: 0, correct: 0 };

  return {
    users: { total: totalUsers, newToday, newThisWeek: newWeek, newThisMonth: newMonth, activeThisWeek: activeWeek, activeThisMonth: activeMonth },
    questions: {
      total: questionsTotal,
      active: questionsActive,
      inReview: questionsReview,
      needsReview: questionsNeedsReview,
      missingCorrectAnswer: questionsMissingAnswer,
      categories,
    },
    engagement: {
      quizzesSubmitted: quizzesTotal,
      mockAttempts,
      answers: answered.total,
      accuracy: answered.total ? Math.round((answered.correct / answered.total) * 100) : 0,
      averageScore: Math.round(scores.avgScore || 0),
      averageDurationSec: Math.round(scores.avgDuration || 0),
      passRate: scores.total ? Math.round((scores.passed / scores.total) * 100) : 0,
      bookmarks,
    },
    reports: { open: reportsOpen },
  };
}

export async function getUserGrowth({ days = 30 } = {}) {
  const capped = Math.min(Math.max(days, 7), 180);
  const rows = await countByDay(User, 'createdAt', capped);
  return dailySeries(rows, capped);
}

export async function getActivityTrend({ days = 30 } = {}) {
  const capped = Math.min(Math.max(days, 7), 180);
  const [answers, quizzes] = await Promise.all([
    UserAnswer.aggregate([
      { $match: { answeredAt: { $gte: daysAgo(capped - 1) } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$answeredAt', timezone: TZ } },
          answered: { $sum: 1 },
          correct: { $sum: { $cond: ['$correct', 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    countByDay(Quiz, 'submittedAt', capped, { status: 'submitted' }),
  ]);

  const quizMap = new Map(quizzes.map((q) => [q._id, q.count]));
  const answerMap = new Map(answers.map((a) => [a._id, a]));
  const series = [];
  for (let i = capped - 1; i >= 0; i -= 1) {
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(Date.now() - i * DAY));
    const a = answerMap.get(key);
    series.push({ date: key, answered: a?.answered || 0, correct: a?.correct || 0, quizzes: quizMap.get(key) || 0 });
  }
  return series;
}

export async function getCategoryPerformance() {
  const rows = await UserAnswer.aggregate([
    {
      $group: {
        _id: '$category',
        answered: { $sum: 1 },
        correct: { $sum: { $cond: ['$correct', 1, 0] } },
        users: { $addToSet: '$user' },
      },
    },
  ]);
  const byId = new Map(rows.map((r) => [String(r._id), r]));
  const categories = await Category.find().select('name nameEn slug color order questionCount').sort({ order: 1 }).lean();
  return categories.map((c) => {
    const stat = byId.get(String(c._id));
    const answered = stat?.answered || 0;
    return {
      id: c._id,
      slug: c.slug,
      name: c.name,
      color: c.color,
      questions: c.questionCount || 0,
      answered,
      correct: stat?.correct || 0,
      learners: stat?.users?.length || 0,
      accuracy: answered ? Math.round((stat.correct / answered) * 100) : 0,
    };
  });
}

export async function getQuestionInsights({ limit = 15, minAnswers = 5 } = {}) {
  const [hardest, neverAnswered, mostReported] = await Promise.all([
    Question.find({ 'stats.timesAnswered': { $gte: minAnswers } })
      .select('questionNumber questionText stats categorySlug difficulty')
      .sort({ 'stats.timesMissed': -1 })
      .limit(limit)
      .lean(),
    Question.find({ 'stats.timesAnswered': 0, status: 'active' }).select('questionNumber questionText categorySlug').limit(limit).lean(),
    QuestionReport.aggregate([
      { $match: { status: { $in: ['pending', 'under_review'] } } },
      { $group: { _id: '$question', reports: { $sum: 1 }, reasons: { $addToSet: '$reason' } } },
      { $sort: { reports: -1 } },
      { $limit: limit },
    ]),
  ]);

  const reportedIds = mostReported.map((r) => r._id);
  const reportedQuestions = reportedIds.length
    ? await Question.find({ _id: { $in: reportedIds } }).select('questionNumber questionText categorySlug').lean()
    : [];
  const qMap = new Map(reportedQuestions.map((q) => [String(q._id), q]));

  const withMissRate = (q) => ({
    id: q._id,
    questionNumber: q.questionNumber,
    questionText: q.questionText,
    categorySlug: q.categorySlug,
    difficulty: q.difficulty,
    timesAnswered: q.stats?.timesAnswered || 0,
    timesCorrect: q.stats?.timesCorrect || 0,
    timesMissed: q.stats?.timesMissed || 0,
    missRate: q.stats?.timesAnswered ? Math.round((q.stats.timesMissed / q.stats.timesAnswered) * 100) : 0,
  });

  return {
    hardest: hardest.map(withMissRate).filter((q) => q.missRate > 0),
    neverAnswered: neverAnswered.map((q) => ({
      id: q._id,
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      categorySlug: q.categorySlug,
    })),
    mostReported: mostReported
      .map((r) => {
        const q = qMap.get(String(r._id));
        return q ? { ...q, id: q._id, reports: r.reports, reasons: r.reasons } : null;
      })
      .filter(Boolean),
  };
}

export async function getReviewQueue({ page = 1, limit = 50 } = {}) {
  const skip = (Math.max(1, page) - 1) * limit;
  const filter = { $or: [{ status: 'review' }, { needsReview: true }] };
  const [items, total] = await Promise.all([
    Question.find(filter)
      .select('questionNumber questionText options flags status examinable needsReview categorySlug source')
      .sort({ questionNumber: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Question.countDocuments(filter),
  ]);
  return {
    items: items.map((q) => ({
      id: q._id,
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      options: q.options.map((o) => ({ id: o.id, label: o.label, text: o.text, isCorrect: o.isCorrect })),
      issues: q.flags,
      status: q.status,
      examinable: q.examinable,
      categorySlug: q.categorySlug,
      source: q.source,
    })),
    total,
    page,
    limit,
  };
}

export async function getLeaderboard({ limit = 20 } = {}) {
  const users = await User.find({ role: 'USER', status: 'active' })
    .select('fullName gamification studyStats preferences')
    .sort({ 'gamification.xp': -1, 'studyStats.questionsCorrect': -1 })
    .limit(Math.min(Math.max(limit, 1), 100))
    .lean();
  return users.map((u, i) => ({
    rank: i + 1,
    id: u._id,
    name: u.fullName,
    xp: u.gamification?.xp || 0,
    level: u.gamification?.level || 1,
    accuracy: u.studyStats?.questionsAttempted ? Math.round((u.studyStats.questionsCorrect / u.studyStats.questionsAttempted) * 100) : 0,
    testsCompleted: u.studyStats?.testsCompleted || 0,
    currentStreak: u.gamification?.currentStreak || 0,
  }));
}

export async function getRecentActivity({ limit = 30 } = {}) {
  return AdminActivity.find().sort({ createdAt: -1 }).limit(Math.min(Math.max(limit, 1), 100)).populate('actor', 'fullName email role').lean();
}

export default {
  getOverview,
  getUserGrowth,
  getActivityTrend,
  getCategoryPerformance,
  getQuestionInsights,
  getReviewQueue,
  getLeaderboard,
  getRecentActivity,
};
