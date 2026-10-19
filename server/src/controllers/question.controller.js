import mongoose from 'mongoose';
import { Question, Category, UserAnswer } from '../models/index.js';
import * as questionService from '../services/question.service.js';
import { success } from '../middleware/error.js';
import { recordActivity } from '../middleware/audit.js';
import ApiError from '../utils/api-error.js';

/* ------------------------------------------------------------------ *
 * Public / learner
 * ------------------------------------------------------------------ */
export async function listQuestions(req, res) {
  const query = req.validatedQuery || req.query;
  const { items, meta } = await questionService.listQuestions({ query, user: req.user || null, staff: false });
  return success(res, items, 200, meta);
}

export async function getQuestion(req, res) {
  const question = await questionService.getQuestion(req.params.id, { staff: false });
  return success(res, { question });
}

export async function randomQuestion(req, res) {
  const { category, difficulty } = req.query;
  const match = { status: 'active', examinable: true };
  if (category) {
    if (mongoose.isValidObjectId(category)) match.category = new mongoose.Types.ObjectId(category);
    else match.categorySlug = category;
  }
  if (difficulty && difficulty !== 'all') match.difficulty = difficulty;

  const [question] = await Question.aggregate([{ $match: match }, { $sample: { size: 1 } }]);
  if (!question) throw ApiError.notFound('Nta kibazo kibonetse', 'NO_QUESTION');
  const hydrated = await Question.findById(question._id).populate('category', 'name slug color icon');
  return success(res, { question: questionService.toPublicQuestion(hydrated, { includeCorrect: true }) });
}

/* ------------------------------------------------------------------ *
 * Admin
 * ------------------------------------------------------------------ */
export async function adminList(req, res) {
  const query = req.validatedQuery || req.query;
  const { items, meta } = await questionService.listQuestions({ query, user: req.user, staff: true });
  return success(res, items, 200, meta);
}

export async function adminGet(req, res) {
  const question = await questionService.getQuestion(req.params.id, { staff: true });
  return success(res, { question });
}

export async function createQuestion(req, res) {
  const question = await questionService.createQuestion(req.body, req.user);
  await recordActivity(req, {
    action: 'question.create',
    resource: 'question',
    resourceId: question._id,
    meta: { questionNumber: question.questionNumber },
  });
  return success(res, { question: questionService.toPublicQuestion(question, { includeCorrect: true }) }, 201);
}

export async function updateQuestion(req, res) {
  const question = await questionService.updateQuestion(req.params.id, req.body, req.user);
  await recordActivity(req, { action: 'question.update', resource: 'question', resourceId: question._id });
  return success(res, { question: questionService.toPublicQuestion(question, { includeCorrect: true }) });
}

export async function deleteQuestion(req, res) {
  const result = await questionService.deleteQuestion(req.params.id);
  await recordActivity(req, {
    action: result.soft ? 'question.soft_delete' : 'question.delete',
    resource: 'question',
    resourceId: req.params.id,
  });
  return success(res, { deleted: true, soft: result.soft });
}

export async function bulkAction(req, res) {
  const { action, ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) throw ApiError.badRequest('Nta bibazo byatoranyijwe', 'NO_IDS');
  const validIds = ids.filter((id) => mongoose.isValidObjectId(id));
  if (!validIds.length) throw ApiError.badRequest('Indangamuntu zose ntiziriho', 'INVALID_IDS');

  let result = { matched: 0, modified: 0 };

  if (action === 'publish') {
    const missingAnswer = await Question.find({ _id: { $in: validIds }, examinable: false }).select('_id').lean();
    if (missingAnswer.length) {
      throw ApiError.badRequest(
        `Ibibazo ${missingAnswer.length} ntibifite igisubizo kimwe cy’ukuri, ntibishobora gutangazwa`,
        'NOT_EXAMINABLE',
        { ids: missingAnswer.map((q) => q._id) },
      );
    }
    const r = await Question.updateMany({ _id: { $in: validIds } }, { $set: { status: 'active', needsReview: false } });
    result = { matched: r.matchedCount, modified: r.modifiedCount };
  } else if (action === 'unpublish') {
    const r = await Question.updateMany({ _id: { $in: validIds } }, { $set: { status: 'inactive' } });
    result = { matched: r.matchedCount, modified: r.modifiedCount };
  } else if (action === 'delete') {
    for (const id of validIds) await questionService.deleteQuestion(id);
    result = { matched: validIds.length, modified: validIds.length };
  } else if (action === 'category') {
    const category = await Category.findById(req.body.category);
    if (!category) throw ApiError.badRequest('Icyiciro ntikibonetse', 'CATEGORY_NOT_FOUND');
    const r = await Question.updateMany(
      { _id: { $in: validIds } },
      { $set: { category: category._id, categorySlug: category.slug } },
    );
    result = { matched: r.matchedCount, modified: r.modifiedCount };
  } else {
    throw ApiError.badRequest('Igikorwa ntikimenyekana', 'UNKNOWN_BULK_ACTION');
  }

  await questionService.refreshCategoryCounts();
  await recordActivity(req, { action: `question.bulk_${action}`, resource: 'question', meta: { count: validIds.length } });
  return success(res, result);
}

export async function questionStats(req, res) {
  const [byStatus, byDifficulty, byCategory, unassigned, noAnswer] = await Promise.all([
    Question.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Question.aggregate([{ $group: { _id: '$difficulty', count: { $sum: 1 } } }]),
    Question.aggregate([{ $group: { _id: '$categorySlug', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Question.countDocuments({ category: null }),
    Question.countDocuments({ examinable: false, status: { $ne: 'inactive' } }),
  ]);

  const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id || 'unknown', r.count]));
  return success(res, {
    total: await Question.countDocuments(),
    byStatus: toMap(byStatus),
    byDifficulty: toMap(byDifficulty),
    byCategory: toMap(byCategory),
    unassigned,
    missingCorrectAnswer: noAnswer,
    answeredQuestions: await UserAnswer.distinct('question').then((r) => r.length),
  });
}

export default {
  listQuestions,
  getQuestion,
  randomQuestion,
  adminList,
  adminGet,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  bulkAction,
  questionStats,
};
