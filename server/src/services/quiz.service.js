import mongoose from 'mongoose';
import ApiError from '../utils/api-error.js';
import { Question, Quiz, UserAnswer, Bookmark, Settings, Category, User, Entitlement } from '../models/index.js';
import { gradeQuiz, rankCategories } from './scoring.service.js';
import { addXp, evaluateAchievements, touchStreak } from './achievement.service.js';
import { notify } from './notification.service.js';
import {
  assertPremiumForType,
  assertDailyMockQuota,
  assertDailyQuestionQuota,
  getAccessState,
  consumeFreeQuestions,
  consumeFreePracticeAttempt,
} from './entitlement.service.js';

const ACTIVE_POOL = { status: 'active', examinable: true };

async function resolveCategoryIds(categories = []) {
  if (!categories?.length) return [];
  const ids = [];
  for (const value of categories) {
    if (mongoose.isValidObjectId(value)) ids.push(new mongoose.Types.ObjectId(value));
    else {
      const cat = await Category.findOne({ slug: value }).select('_id');
      if (cat) ids.push(cat._id);
    }
  }
  return ids;
}

/**
 * Builds the pool of questions for a quiz request. Every returned question is
 * published (status=active) and scoreable (exactly one correct answer).
 */
export async function buildQuestionPool({ user, type = 'practice', options = {} }) {
  const settings = await Settings.getSettings();
  const {
    count,
    categories = [],
    difficulty = 'all',
    mode = 'random',
    includeReview = false,
  } = options;

  const match = { ...ACTIVE_POOL };
  if (!includeReview) match.status = 'active';
  const categoryIds = await resolveCategoryIds(categories);
  if (categoryIds.length) match.category = { $in: categoryIds };
  if (difficulty && difficulty !== 'all') match.difficulty = difficulty;

  let requested = Number(count) || settings.practiceDefaultCount;
  if (type === 'mock') requested = Number(count) || settings.examQuestionCount;
  requested = Math.min(Math.max(5, requested), 200);

  if (type === 'mistakes' || mode === 'incorrect') {
    const ids = await lastMissedQuestionIds(user._id, { categoryIds, difficulty });
    if (!ids.length) return { questions: [], requested, available: 0 };
    const q = await Question.find({ ...match, _id: { $in: ids } }).limit(requested);
    return { questions: shuffle(q), requested, available: ids.length };
  }

  if (type === 'bookmarks' || mode === 'bookmarked') {
    const bookmarks = await Bookmark.find({ user: user._id }).select('question').lean();
    const ids = bookmarks.map((b) => b.question);
    if (!ids.length) return { questions: [], requested, available: 0 };
    const q = await Question.find({ ...match, _id: { $in: ids } }).limit(requested);
    return { questions: shuffle(q), requested, available: ids.length };
  }

  if (mode === 'sequential') {
    const q = await Question.find(match).sort({ questionNumber: 1 }).limit(requested);
    return { questions: q, requested, available: q.length };
  }

  const available = await Question.countDocuments(match);
  const size = Math.min(requested, available);
  const questions = size
    ? await Question.aggregate([{ $match: match }, { $sample: { size } }])
    : [];
  const hydrated = await Question.populate(questions, { path: 'category', select: 'name slug color icon' });
  return { questions: hydrated, requested, available };
}

/**
 * Questions whose most recent answer was wrong and that have not been answered
 * correctly afterwards.
 */
export async function lastMissedQuestionIds(userId, { categoryIds = [], difficulty } = {}) {
  const match = { user: new mongoose.Types.ObjectId(String(userId)) };
  if (categoryIds.length) match.category = { $in: categoryIds };

  const rows = await UserAnswer.aggregate([
    { $match: match },
    { $sort: { answeredAt: -1 } },
    {
      $group: {
        _id: '$question',
        lastCorrect: { $first: '$correct' },
        lastAt: { $first: '$answeredAt' },
      },
    },
    { $match: { lastCorrect: false } },
    { $sort: { lastAt: -1 } },
  ]);

  let ids = rows.map((r) => r._id);
  if (difficulty && difficulty !== 'all' && ids.length) {
    const allowed = await Question.find({ _id: { $in: ids }, difficulty }).select('_id').lean();
    const allowedSet = new Set(allowed.map((a) => String(a._id)));
    ids = ids.filter((id) => allowedSet.has(String(id)));
  }
  return ids;
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function startQuiz(user, { type = 'practice', options = {} } = {}) {
  const settings = await Settings.getSettings();

  if (type === 'mock' && !user.emailVerified && settings.requireEmailVerification) {
    throw ApiError.forbidden('Emeza email yawe mbere yo gukora ikizamini', 'EMAIL_NOT_VERIFIED');
  }

  // Premium-only flows (mock exams, mistakes, bookmarks) require a subscription.
  await assertPremiumForType(user, type);

  const access = await getAccessState(user._id);
  if (!access.isPremium && access.questionsLimitReached) {
    throw ApiError.forbidden(
      'Ikizamini cy’ubuntu kirangiye. Kora subscription ya premium kugira ngo ukomeze.',
      'FREE_LIMIT_REACHED',
      {
        freeQuestionsAllowed: access.freeQuestionsAllowed,
        freeQuestionsUsed: access.freeQuestionsUsed,
        freeQuestionsRemaining: access.freeQuestionsRemaining,
      },
    );
  }

  const planEntitlements = access.subscription?.entitlements || null;

  // Plan-level mock-exam quota (subscriptions with a finite dailyMockExams).
  if (type === 'mock') {
    await assertDailyMockQuota(planEntitlements, user._id);
  }

  const { questions } = await buildQuestionPool({ user, type, options });
  if (questions.length < 5) {
    throw ApiError.badRequest(
      type === 'mock'
        ? 'Nta bibazo bihagije kuri iki kizamini. Banza ukore ibindi.'
        : 'Nta bibazo bihuye n’ibyo wasabye. Hindura amahitamo.',
      'INSUFFICIENT_QUESTIONS',
      { found: questions.length },
    );
  }

  // Free learners may only ever see questions within their remaining allowance.
  if (!access.isPremium) {
    const remaining = access.freeQuestionsRemaining;
    if (remaining <= 0) {
      throw ApiError.forbidden(
        'Ikizamini cy’ubuntu kirangiye. Kora subscription ya premium kugira ngo ukomeze.',
        'FREE_LIMIT_REACHED',
        { freeQuestionsAllowed: access.freeQuestionsAllowed, freeQuestionsUsed: access.freeQuestionsUsed },
      );
    }
    const trimmed = questions.slice(0, Math.min(questions.length, remaining));
    if (trimmed.length < 5) {
      throw ApiError.forbidden(
        `Ufite ibibazo ${remaining} gusa bisigaye ku buntu. Bikenewe nibura 5. Kora subscription ya premium.`,
        'FREE_LIMIT_REACHED',
        { freeQuestionsRemaining: remaining },
      );
    }
    questions.length = 0;
    questions.push(...trimmed);
  } else if (access.isPremium) {
    // Plan-level daily question quota (subscriptions with a finite dailyQuestions).
    await assertDailyQuestionQuota(planEntitlements, user._id, { needed: questions.length });
  }

  // Free learners: atomically reserve the questions this quiz is about to
  // consume so parallel quiz starts cannot race past the allowance.
  let reservedQuestions = 0;
  if (!access.isPremium) {
    reservedQuestions = questions.length;
    const allowedCeiling = Number.isFinite(access.freeQuestionsAllowed) ? access.freeQuestionsAllowed : 40;
    const reserve = await Entitlement.findOneAndUpdate(
      {
        user: user._id,
        $expr: {
          $lte: [
            { $add: [{ $ifNull: ['$freeQuestionsUsed', 0] }, { $ifNull: ['$pendingReservedQuestions', 0] }, reservedQuestions] },
            allowedCeiling,
          ],
        },
      },
      { $inc: { pendingReservedQuestions: reservedQuestions } },
      { new: true },
    );
    if (!reserve) {
      throw ApiError.forbidden(
        'Ikizamini cy’ubuntu kirangiye. Kora subscription ya premium kugira ngo ukomeze.',
        'FREE_LIMIT_REACHED',
        { freeQuestionsAllowed: access.freeQuestionsAllowed, freeQuestionsUsed: access.freeQuestionsUsed },
      );
    }
  }

  const isMock = type === 'mock';
  const timeLimitSec = isMock ? settings.examDurationMinutes * 60 : null;

  let quiz;
  try {
    quiz = await Quiz.create({
      user: user._id,
      type,
      title: isMock ? 'Ikizamini cy’igerageza' : 'Imyitozo',
      config: {
        requestedCount: questions.length,
        categories: await resolveCategoryIds(options.categories || []),
        difficulty: options.difficulty || 'all',
        mode: options.mode || 'random',
        // feedbackMode is server-derived only. Mock exams must never reveal
        // answers before submission, regardless of what the client sends.
        feedbackMode: isMock ? 'end' : 'immediate',
        passingScore: isMock ? settings.passingScorePercent : null,
        reservedQuestions,
      },
      questions: questions.map((q, i) => ({ question: q._id, order: i, category: q.category?._id || q.category || null })),
      answers: questions.map((q) => ({ question: q._id })),
      startedAt: new Date(),
      timeLimitSec,
      expiresAt: timeLimitSec ? new Date(Date.now() + timeLimitSec * 1000) : null,
      score: { total: questions.length, passingScore: isMock ? settings.passingScorePercent : null },
    });
  } catch (err) {
    // Release the reservation if the quiz could not be created.
    if (reservedQuestions > 0) {
      await Entitlement.updateOne({ user: user._id }, { $inc: { pendingReservedQuestions: -reservedQuestions } });
    }
    throw err;
  }

  return { quiz, questions };
}

export async function getQuizForUser(user, quizId) {
  const quiz = await Quiz.findOne({ _id: quizId, user: user._id });
  if (!quiz) throw ApiError.notFound('Ikizamini ntikibonetse', 'QUIZ_NOT_FOUND');
  return quiz;
}

/** The quiz a user was in the middle of, so they can continue where they stopped. */
export async function getActiveQuiz(user) {
  return Quiz.findOne({ user: user._id, status: 'in_progress' }).sort({ createdAt: -1 }).lean();
}

/**
 * Saves a single answer. Used by practice mode for immediate feedback; mock
 * exams also call this so nothing is lost if the tab is closed.
 */
export async function saveAnswer(user, quizId, { questionId, selectedOptionId, timeSpentMs }) {
  const quiz = await getQuizForUser(user, quizId);
  if (quiz.status !== 'in_progress') throw ApiError.badRequest('Iki kizamini cyarangiye', 'QUIZ_SUBMITTED');
  // Server-side timer enforcement: no answers may be recorded after expiry.
  if (quiz.expiresAt && quiz.expiresAt < new Date()) {
    quiz.status = 'expired';
    quiz.submittedAt = new Date();
    await quiz.save();
    throw ApiError.badRequest('Igihe cy’iki kizamini cyarangiye', 'QUIZ_EXPIRED');
  }

  const question = await Question.findById(questionId);
  if (!question) throw ApiError.notFound('Ikibazo ntikibonetso', 'QUESTION_NOT_FOUND');

  const entry = quiz.answers.find((a) => String(a.question) === String(questionId));
  if (!entry) throw ApiError.badRequest('Iki kibazo nticyari muri iki kizamini', 'QUESTION_NOT_IN_QUIZ');

  entry.selectedOptionId = selectedOptionId || null;
  entry.answered = Boolean(selectedOptionId);
  entry.correct = Boolean(selectedOptionId) && question.options.some((o) => o.id === selectedOptionId && o.isCorrect);
  entry.timeSpentMs = Number(timeSpentMs) || entry.timeSpentMs;
  entry.answeredAt = new Date();
  await quiz.save();

  return {
    quizId: quiz._id,
    questionId,
    selectedOptionId: entry.selectedOptionId,
    correct: entry.correct,
    answered: entry.answered,
    feedbackMode: quiz.config.feedbackMode,
  };
}

export async function submitQuiz(user, quizId, { selections = {} } = {}) {
  // Atomic claim: only one submit per quiz can win. The winner flips the quiz
  // out of `in_progress`; a concurrent double-submit loses the race here.
  const now = new Date();
  const claimed = await Quiz.findOneAndUpdate(
    { _id: quizId, user: user._id, status: 'in_progress' },
    { $set: { status: 'submitted', submittedAt: now } },
    { new: true },
  );

  let quiz = claimed;
  if (!quiz) {
    const existing = await getQuizForUser(user, quizId);
    if (existing.status === 'submitted') {
      throw ApiError.conflict('Iki kizamini cyatanzwe', 'QUIZ_ALREADY_SUBMITTED');
    }
    // `expired` quizzes may still be submitted so saved answers get graded
    // (auto-submit after tab close); new selections are ignored for them.
    if (existing.status !== 'expired') {
      throw ApiError.badRequest('Iki kizamini ntikiri po', 'QUIZ_NOT_ACTIVE');
    }
    quiz = await Quiz.findOneAndUpdate(
      { _id: quizId, user: user._id, status: 'expired' },
      { $set: { status: 'submitted', submittedAt: now } },
      { new: true },
    );
    if (!quiz) throw ApiError.conflict('Iki kizamini cyatanzwe', 'QUIZ_ALREADY_SUBMITTED');
  }

  // Server-side timer: past the deadline only answers already saved count.
  const pastDeadline = Boolean(quiz.expiresAt && quiz.expiresAt < now);

  const questionIds = quiz.questions.map((q) => q.question);
  const questions = await Question.find({ _id: { $in: questionIds } }).populate('category', 'name slug color');
  const byId = new Map(questions.map((q) => [String(q._id), q]));
  const ordered = quiz.questions
    .sort((a, b) => a.order - b.order)
    .map((entry) => byId.get(String(entry.question)))
    .filter(Boolean);

  // Merge already-saved answers with the submitted selections (submit wins),
  // but ignore fresh selections once the time limit has passed.
  const finalSelections = {};
  for (const entry of quiz.answers) {
    if (entry.selectedOptionId) finalSelections[String(entry.question)] = entry.selectedOptionId;
  }
  if (!pastDeadline) {
    for (const [qid, optionId] of Object.entries(selections || {})) {
      if (optionId) finalSelections[String(qid)] = optionId;
    }
  }

  const settings = await Settings.getSettings();
  const passingScore = quiz.type === 'mock' ? settings.passingScorePercent : null;
  const result = gradeQuiz(ordered, finalSelections, { passingScore });

  quiz.answers = ordered.map((q) => {
    const qid = String(q._id);
    const selected = finalSelections[qid] ?? null;
    const prev = quiz.answers.find((a) => String(a.question) === qid);
    return {
      question: q._id,
      selectedOptionId: selected,
      answered: Boolean(selected),
      correct: result.details.find((d) => d.question === qid)?.correct || false,
      timeSpentMs: prev?.timeSpentMs || 0,
      answeredAt: selected ? new Date() : null,
    };
  });

  quiz.score = {
    total: result.total,
    correct: result.correct,
    incorrect: result.incorrect,
    unanswered: result.unanswered,
    percentage: result.percentage,
    passed: result.passed ?? false,
    passingScore: result.passingScore,
    byCategory: result.byCategory,
  };
  quiz.status = 'submitted';
  quiz.submittedAt = now;
  // durationSec is server-computed and clamped to the time limit - the client
  // value is never trusted.
  const elapsed = Math.max(0, Math.round((now.getTime() - quiz.startedAt.getTime()) / 1000));
  quiz.durationSec = quiz.timeLimitSec ? Math.min(elapsed, quiz.timeLimitSec) : elapsed;
  await quiz.save();

  await persistUserAnswers(user, quiz, ordered, finalSelections);
  await updateUserStats(user, result, quiz);

  // Release the free-question reservation taken at quiz start (if any).
  const reserved = Number(quiz.config?.reservedQuestions) || 0;
  if (reserved > 0) {
    await Entitlement.updateOne(
      { user: user._id },
      { $inc: { pendingReservedQuestions: -reserved } },
    );
  }

  // Consume free allowance for learners without an active subscription. Study
  // sessions count towards distinct questions but not the practice-attempt cap.
  const access = await getAccessState(user._id);
  if (!access.isPremium) {
    const answeredIds = ordered
      .filter((q) => finalSelections[String(q._id)])
      .map((q) => q._id);
    await consumeFreeQuestions(user._id, answeredIds);
    if (quiz.type !== 'study') {
      await consumeFreePracticeAttempt(user._id);
    }
  }

  const graded = { quiz, result, questions: ordered, selections: finalSelections };
  return graded;
}

async function persistUserAnswers(user, quiz, questions, selections) {
  const docs = [];
  for (const q of questions) {
    const qid = String(q._id);
    const selected = selections[qid] ?? null;
    const correctOption = q.options.find((o) => o.isCorrect)?.id || null;
    const entry = quiz.answers.find((a) => String(a.question) === qid);
    docs.push({
      user: user._id,
      quiz: quiz._id,
      question: q._id,
      category: q.category?._id || q.category || null,
      quizType: quiz.type,
      selectedOptionId: selected,
      correctOptionId: correctOption,
      correct: Boolean(selected) && selected === correctOption,
      answered: Boolean(selected),
      timeSpentMs: entry?.timeSpentMs || 0,
      answeredAt: new Date(),
    });
    const inc = { 'stats.timesAnswered': 1 };
    if (selected && selected === correctOption) inc['stats.timesCorrect'] = 1;
    if (selected && selected !== correctOption) inc['stats.timesMissed'] = 1;
    await Question.updateOne({ _id: q._id }, { $inc: inc });
  }
  if (docs.length) await UserAnswer.insertMany(docs, { ordered: false });
}

async function updateUserStats(user, result, quiz) {
  const fresh = await User.findById(user._id);
  if (!fresh) return;
  fresh.studyStats.questionsAttempted += result.total;
  fresh.studyStats.questionsCorrect += result.correct;
  fresh.studyStats.testsCompleted += quiz.type === 'study' ? 0 : 1;
  fresh.studyStats.totalStudySeconds += quiz.durationSec || 0;
  fresh.studyStats.bestScore = Math.max(fresh.studyStats.bestScore || 0, result.percentage);
  fresh.studyStats.lastActiveAt = new Date();

  touchStreak(fresh);
  const settings = await Settings.getSettings();
  await addXp(fresh, result.correct * settings.xpPerCorrectAnswer + settings.xpPerTest);

  await notify(fresh, {
    type: 'test_result',
    title: 'Ikizamini cyarangiye',
    body: `Amanota yawe: ${result.percentage}% (${result.correct}/${result.total})`,
    data: { quizId: String(quiz._id), percentage: result.percentage },
  });

  await evaluateAchievements(fresh);
}

export function quizResultPayload({ quiz, result, questions, selections }) {
  return {
    quizId: quiz._id,
    type: quiz.type,
    status: quiz.status,
    submittedAt: quiz.submittedAt,
    durationSec: quiz.durationSec,
    score: quiz.score,
    breakdown: result?.byCategory || quiz.score.byCategory,
    ranks: result ? rankCategories(result.byCategory) : undefined,
    details: questions?.map((q) => {
      const qid = String(q._id);
      const selected = selections?.[qid] ?? null;
      const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
      return {
        question: q.toStudentJSON({ includeCorrect: true }),
        selectedOptionId: selected,
        correctOptionIds: correctIds,
        correct: Boolean(selected) && correctIds.includes(selected),
        answered: Boolean(selected),
      };
    }),
  };
}

export async function listQuizzes(user, { page = 1, limit = 20, type, status } = {}) {
  const filter = { user: user._id };
  if (type) filter.type = type;
  if (status) filter.status = status;
  const skip = (Math.max(1, page) - 1) * limit;
  const [items, total] = await Promise.all([
    Quiz.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select('-answers -questions').lean(),
    Quiz.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

export async function deleteQuiz(user, quizId) {
  const res = await Quiz.findOneAndDelete({ _id: quizId, user: user._id });
  if (!res) throw ApiError.notFound('Ikizamini ntikibonetse', 'QUIZ_NOT_FOUND');
  return res;
}

export async function expireStaleQuizzes(userId) {
  const now = new Date();
  // Release any free-question reservations held by quizzes that timed out.
  const stale = await Quiz.find({
    user: userId,
    status: 'in_progress',
    expiresAt: { $lt: now },
  }).select('config.reservedQuestions').lean();
  const totalReserved = stale.reduce((sum, q) => sum + (Number(q.config?.reservedQuestions) || 0), 0);
  if (totalReserved > 0) {
    await Entitlement.updateOne({ user: userId }, { $inc: { pendingReservedQuestions: -totalReserved } });
  }
  return Quiz.updateMany(
    { user: userId, status: 'in_progress', expiresAt: { $lt: now } },
    { status: 'expired' },
  );
}

export default {
  buildQuestionPool,
  startQuiz,
  getQuizForUser,
  getActiveQuiz,
  saveAnswer,
  submitQuiz,
  quizResultPayload,
  listQuizzes,
  deleteQuiz,
  expireStaleQuizzes,
  lastMissedQuestionIds,
};
