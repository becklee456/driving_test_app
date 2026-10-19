import mongoose from 'mongoose';
import { QuestionReport, Question, User } from '../models/index.js';
import { notify } from '../services/notification.service.js';
import { success } from '../middleware/error.js';
import { recordActivity } from '../middleware/audit.js';
import { parsePagination, escapeRegex } from '../utils/pagination.js';
import ApiError from '../utils/api-error.js';
import { REPORT_REASONS, REPORT_STATUS } from '../models/question-report.model.js';

export async function createReport(req, res) {
  const { questionId, reason, message } = req.body;
  if (!REPORT_REASONS.includes(reason)) throw ApiError.badRequest('Impamvu ntariyo', 'INVALID_REASON');
  const question = await Question.findById(questionId).select('_id status');
  if (!question) throw ApiError.notFound('Ikibazo ntikibonetse', 'QUESTION_NOT_FOUND');

  const existing = await QuestionReport.findOne({ user: req.user._id, question: questionId, status: { $in: ['pending', 'under_review'] } });
  if (existing) throw ApiError.conflict('Usanzwe watanze ikirego kuri iki kibazo', 'REPORT_EXISTS');

  const report = await QuestionReport.create({
    user: req.user._id,
    question: questionId,
    reason,
    message: message || '',
  });
  await Question.updateOne({ _id: questionId }, { $inc: { 'stats.reportsCount': 1 } });
  await recordActivity(req, { action: 'report.create', resource: 'report', resourceId: report._id, meta: { questionId, reason } });
  return success(res, { report }, 201);
}

export async function listMyReports(req, res) {
  const reports = await QuestionReport.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('question', 'questionNumber questionText')
    .lean();
  return success(res, { reports });
}

/* ------------------------------------------------------------------ *
 * Admin
 * ------------------------------------------------------------------ */
export async function listReports(req, res) {
  const query = req.validatedQuery || req.query;
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 20, maxLimit: 100 });
  const filter = {};
  if (query.status && query.status !== 'all') filter.status = query.status;
  if (query.reason && query.reason !== 'all') filter.reason = query.reason;

  const [items, total] = await Promise.all([
    QuestionReport.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'fullName email')
      .populate('question', 'questionNumber questionText categorySlug status')
      .populate('handledBy', 'fullName email')
      .lean(),
    QuestionReport.countDocuments(filter),
  ]);

  const counts = await QuestionReport.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  return success(res, items, 200, {
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    counts: Object.fromEntries(counts.map((c) => [c._id, c.count])),
  });
}

export async function updateReport(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest('Indangamuntu itariyo', 'INVALID_ID');
  const { status, resolutionNote } = req.body;
  if (status && !REPORT_STATUS.includes(status)) throw ApiError.badRequest('Imiterere ntariyo', 'INVALID_STATUS');

  const report = await QuestionReport.findById(req.params.id);
  if (!report) throw ApiError.notFound('Ikirego ntikibonetse', 'REPORT_NOT_FOUND');

  if (status) report.status = status;
  if (resolutionNote !== undefined) report.resolutionNote = resolutionNote;
  if (['resolved', 'rejected'].includes(report.status)) {
    report.handledBy = req.user._id;
    report.handledAt = new Date();
  }
  await report.save();

  if (report.user && status) {
    const reporter = await User.findById(report.user);
    if (reporter) {
      await notify(reporter, {
        type: 'report_update',
        title: 'Ikirego cyawe cyagenzuye',
        body: status === 'resolved' ? 'Ikirego cyawe cyakemutse. Murakoze!' : 'Ikirego cyawe kirimo kwiga.',
        data: { reportId: String(report._id), status },
      });
    }
  }

  await recordActivity(req, { action: 'report.update', resource: 'report', resourceId: report._id, meta: { status } });
  return success(res, { report });
}

export async function reportSearchQuestions(req, res) {
  const term = String(req.query.q || '').trim();
  if (!term) return success(res, { questions: [] });
  const re = new RegExp(escapeRegex(term), 'i');
  const questions = await Question.find({ $or: [{ questionText: re }, { questionNumber: Number.parseInt(term, 10) || -1 }] })
    .select('questionNumber questionText categorySlug')
    .limit(20)
    .lean();
  return success(res, { questions });
}

export default { createReport, listMyReports, listReports, updateReport, reportSearchQuestions };
