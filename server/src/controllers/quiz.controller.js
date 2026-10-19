import { Quiz, Question } from '../models/index.js';
import * as quizService from '../services/quiz.service.js';
import { success } from '../middleware/error.js';
import ApiError from '../utils/api-error.js';

async function orderedQuestions(quiz) {
  const ids = quiz.questions.map((q) => q.question);
  const docs = await Question.find({ _id: { $in: ids } }).populate('category', 'name slug color');
  const byId = new Map(docs.map((q) => [String(q._id), q]));
  return quiz.questions
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((entry) => byId.get(String(entry.question)))
    .filter(Boolean);
}

function studentQuestion(q, savedAnswer) {
  const base = typeof q.toStudentJSON === 'function' ? q.toStudentJSON({ includeCorrect: false }) : q;
  return {
    ...base,
    category: q.category?.name ? { id: q.category._id, name: q.category.name, slug: q.category.slug, color: q.category.color } : q.category,
    selectedOptionId: savedAnswer?.selectedOptionId || null,
    answered: Boolean(savedAnswer?.answered),
  };
}

/** Full quiz state for the taking screen (no correct answers revealed). */
async function quizState(quiz) {
  await quizService.expireStaleQuizzes(quiz.user);
  const docs = await orderedQuestions(quiz);
  const answerByQuestion = new Map(quiz.answers.map((a) => [String(a.question), a]));
  return {
    quiz: {
      id: quiz._id,
      type: quiz.type,
      title: quiz.title,
      status: quiz.status,
      startedAt: quiz.startedAt,
      timeLimitSec: quiz.timeLimitSec,
      expiresAt: quiz.expiresAt,
      config: quiz.config,
      score: quiz.score,
      questionCount: quiz.questions.length,
    },
    questions: docs.map((q) => studentQuestion(q, answerByQuestion.get(String(q._id)))),
  };
}

export async function startQuiz(req, res) {
  const { type = 'practice', ...options } = req.body || {};

  const previous = await quizService.getActiveQuiz(req.user);
  if (previous) await quizService.expireStaleQuizzes(req.user._id);

  const { quiz } = await quizService.startQuiz(req.user, { type, options });
  const state = await quizState(quiz);
  return success(res, state, 201);
}

export async function getActiveQuiz(req, res) {
  const active = await quizService.getActiveQuiz(req.user);
  if (!active) return success(res, { quiz: null });

  const quiz = await Quiz.findById(active._id);
  const expired = quiz.expiresAt && quiz.expiresAt < new Date();
  if (expired) {
    quiz.status = 'expired';
    quiz.submittedAt = new Date();
    await quiz.save();
    return success(res, { quiz: null });
  }
  const state = await quizState(quiz);
  return success(res, state);
}

export async function getQuiz(req, res) {
  const quiz = await quizService.getQuizForUser(req.user, req.params.id);
  if (quiz.status === 'in_progress') {
    const state = await quizState(quiz);
    return success(res, state);
  }
  const docs = await orderedQuestions(quiz);
  const selections = {};
  for (const a of quiz.answers) if (a.selectedOptionId) selections[String(a.question)] = a.selectedOptionId;
  return success(res, quizService.quizResultPayload({ quiz, result: null, questions: docs, selections }));
}

export async function saveAnswer(req, res) {
  const result = await quizService.saveAnswer(req.user, req.params.id, req.body);
  const reveal = result.feedbackMode === 'immediate';
  const question = reveal ? await Question.findById(result.questionId).populate('category', 'name slug color') : null;
  return success(res, {
    quizId: result.quizId,
    questionId: result.questionId,
    selectedOptionId: result.selectedOptionId,
    answered: result.answered,
    correct: reveal ? result.correct : undefined,
    correctOptionIds: question ? question.options.filter((o) => o.isCorrect).map((o) => o.id) : undefined,
    explanation: question ? question.explanation || null : undefined,
  });
}

export async function submitQuiz(req, res) {
  const { quiz, result, questions, selections } = await quizService.submitQuiz(req.user, req.params.id, req.body || {});
  return success(res, quizService.quizResultPayload({ quiz, result, questions, selections }));
}

export async function getResult(req, res) {
  const quiz = await quizService.getQuizForUser(req.user, req.params.id);
  if (quiz.status === 'in_progress') throw ApiError.badRequest('Iki kizamini ntikirangira', 'QUIZ_IN_PROGRESS');
  const docs = await orderedQuestions(quiz);
  const selections = {};
  for (const a of quiz.answers) if (a.selectedOptionId) selections[String(a.question)] = a.selectedOptionId;
  return success(res, quizService.quizResultPayload({ quiz, result: null, questions: docs, selections }));
}

export async function listQuizzes(req, res) {
  const { page, limit, type, status } = req.query;
  const result = await quizService.listQuizzes(req.user, {
    page: Number(page) || 1,
    limit: Math.min(Number(limit) || 20, 100),
    type,
    status,
  });
  const pages = Math.max(1, Math.ceil(result.total / result.limit));
  return success(res, result.items, 200, { total: result.total, page: result.page, limit: result.limit, pages });
}

export async function deleteQuiz(req, res) {
  await quizService.deleteQuiz(req.user, req.params.id);
  return success(res, { deleted: true });
}

export default {
  startQuiz,
  getActiveQuiz,
  getQuiz,
  saveAnswer,
  submitQuiz,
  getResult,
  listQuizzes,
  deleteQuiz,
};
