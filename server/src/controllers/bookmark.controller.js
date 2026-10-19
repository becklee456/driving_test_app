import { Bookmark, Question } from '../models/index.js';
import { success } from '../middleware/error.js';
import { parsePagination } from '../utils/pagination.js';
import ApiError from '../utils/api-error.js';

export async function listBookmarks(req, res) {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const [items, total] = await Promise.all([
    Bookmark.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: 'question', select: 'questionNumber questionText options category categorySlug difficulty image explanation' })
      .lean(),
    Bookmark.countDocuments({ user: req.user._id }),
  ]);

  const bookmarks = items
    .filter((b) => b.question)
    .map((b) => ({
      id: b._id,
      note: b.note,
      createdAt: b.createdAt,
      question: {
        id: b.question._id,
        questionNumber: b.question.questionNumber,
        questionText: b.question.questionText,
        categorySlug: b.question.categorySlug,
        difficulty: b.question.difficulty,
        image: b.question.image?.url ? b.question.image : null,
        options: b.question.options.map((o) => ({ id: o.id, label: o.label, text: o.text })),
        explanation: b.question.explanation || null,
      },
    }));

  return success(res, bookmarks, 200, { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
}

export async function addBookmark(req, res) {
  const { questionId, note } = req.body;
  const question = await Question.findById(questionId).select('_id status');
  if (!question || question.status !== 'active') throw ApiError.notFound('Ikibazo ntikibonetse', 'QUESTION_NOT_FOUND');

  const existing = await Bookmark.findOne({ user: req.user._id, question: questionId });
  if (existing) {
    if (note !== undefined) {
      existing.note = note;
      await existing.save();
    }
    return success(res, { bookmark: existing, created: false });
  }
  const bookmark = await Bookmark.create({ user: req.user._id, question: questionId, note: note || '' });
  return success(res, { bookmark, created: true }, 201);
}

export async function removeBookmark(req, res) {
  const questionId = req.params.questionId;
  const result = await Bookmark.findOneAndDelete({ user: req.user._id, question: questionId });
  if (!result) throw ApiError.notFound('Iki kibazo nticyabitswe', 'BOOKMARK_NOT_FOUND');
  return success(res, { removed: true });
}

export async function toggleBookmark(req, res) {
  const { questionId } = req.body;
  const existing = await Bookmark.findOne({ user: req.user._id, question: questionId });
  if (existing) {
    await existing.deleteOne();
    return success(res, { bookmarked: false });
  }
  const question = await Question.findById(questionId).select('_id status');
  if (!question || question.status !== 'active') throw ApiError.notFound('Ikibazo ntikibonetse', 'QUESTION_NOT_FOUND');
  await Bookmark.create({ user: req.user._id, question: questionId });
  return success(res, { bookmarked: true });
}

export default { listBookmarks, addBookmark, removeBookmark, toggleBookmark };
