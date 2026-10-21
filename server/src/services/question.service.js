import mongoose from 'mongoose';
import ApiError from '../utils/api-error.js';
import { Question, Category, Bookmark, UserAnswer } from '../models/index.js';
import { normalizeQuestionText } from '../utils/slug.js';
import { escapeRegex, parsePagination } from '../utils/pagination.js';

/** A question can only be scored when exactly one option is marked correct. */
export function computeExaminable(options = []) {
  const correct = options.filter((o) => o.isCorrect).length;
  const withText = options.filter((o) => o.text && o.text.trim()).length;
  return correct === 1 && withText >= 2;
}

/** Normalizes image payloads (array of `{ url }` objects or raw URL strings). */
export function normalizeImages(input = []) {
  const list = Array.isArray(input) ? input : [];
  return list
    .map((i) => (typeof i === 'string' ? { url: i, alt: '' } : { url: i?.url || null, alt: i?.alt || '' }))
    .filter((i) => i.url)
    .map((i) => ({ url: i.url, alt: i.alt || '', publicId: null }));
}

export function validateOptions(options = []) {
  if (!Array.isArray(options) || options.length < 2) {
    throw ApiError.badRequest('Ibibazo bigomba kufite ibisubizo bibiri cyangwa birenze', 'TOO_FEW_OPTIONS');
  }
  if (options.length > 8) {
    throw ApiError.badRequest('Ibisubizo byinshi cyane (urugero: 8)', 'TOO_MANY_OPTIONS');
  }
  const texts = options.map((o) => normalizeQuestionText(o.text));
  if (texts.some((t) => !t)) {
    throw ApiError.badRequest('Buri gisubizo gishobora kuba gafite ubusobotsi', 'EMPTY_OPTION');
  }
  for (let i = 0; i < texts.length; i += 1) {
    for (let j = i + 1; j < texts.length; j += 1) {
      if (texts[i] === texts[j]) {
        throw ApiError.badRequest('Ibisubizo bibiri birimo umwandiko umwe. Hindura kimwe.', 'DUPLICATE_OPTION');
      }
    }
  }
  const correct = options.filter((o) => o.isCorrect);
  if (correct.length === 0) {
    throw ApiError.badRequest('Hitamo igisubizo kimwe cy’ukuri', 'NO_CORRECT_ANSWER');
  }
  if (correct.length > 1) {
    throw ApiError.badRequest('Ibisubizo by’ukuri bigomba kuba bimwe gusa', 'MULTIPLE_CORRECT_ANSWERS');
  }
  return true;
}

export async function resolveCategory({ category, categorySlug }) {
  if (category && mongoose.isValidObjectId(category)) {
    const cat = await Category.findById(category);
    if (cat) return cat;
  }
  if (categorySlug) {
    const cat = await Category.findOne({ slug: categorySlug });
    if (cat) return cat;
  }
  return null;
}

export async function assertNoDuplicate({ questionNumber, questionText, excludeId }) {
  const normalized = normalizeQuestionText(questionText);
  const query = { normalizedText: normalized };
  if (excludeId) query._id = { $ne: excludeId };
  const duplicateByText = await Question.findOne(query).select('_id questionNumber').lean();
  if (duplicateByText) {
    throw ApiError.conflict('Ibibazo kiri mu buryo bwa gatatu bizanzweho (ibibazo bya #)', 'DUPLICATE_QUESTION', {
      existingId: duplicateByText._id,
      existingNumber: duplicateByText.questionNumber,
    });
  }
  if (questionNumber) {
    const numberQuery = { questionNumber };
    if (excludeId) numberQuery._id = { $ne: excludeId };
    const duplicateByNumber = await Question.findOne(numberQuery)
      .select('_id')
      .lean();
    if (duplicateByNumber) {
      throw ApiError.conflict('Iyi namba y’ikibazo isanzweho', 'DUPLICATE_QUESTION_NUMBER');
    }
  }
}

export async function createQuestion(data, user) {
  validateOptions(data.options);
  if (!data.questionText || data.questionText.trim().length < 4) {
    throw ApiError.badRequest('Umwandiko w’ikibazo uri gato', 'EMPTY_QUESTION_TEXT');
  }
  await assertNoDuplicate({ questionNumber: data.questionNumber, questionText: data.questionText });
  const category = await resolveCategory(data);
  const images = normalizeImages(data.images);

  const question = await Question.create({
    sourceId: data.sourceId || null,
    questionNumber: data.questionNumber,
    questionText: data.questionText.trim(),
    category: category?._id || null,
    categorySlug: category?.slug || data.categorySlug || null,
    image: data.image?.url ? { url: data.image.url, alt: data.image.alt || '' } : images[0] ? { url: images[0].url, alt: images[0].alt } : { url: null, alt: '' },
    images,
    options: data.options.map((o, i) => ({
      id: o.id || String.fromCharCode(97 + i),
      label: o.label || String.fromCharCode(97 + i),
      text: o.text,
      isCorrect: Boolean(o.isCorrect),
    })),
    explanation: data.explanation || null,
    difficulty: data.difficulty || 'medium',
    tags: data.tags || [],
    source: data.source || 'manual',
    status: data.status || 'active',
    flags: data.flags || [],
    needsReview: Boolean(data.needsReview) || (data.flags || []).length > 0,
    createdBy: user?._id || null,
    updatedBy: user?._id || null,
  });

  await refreshCategoryCounts();
  return question;
}

export async function updateQuestion(id, data, user) {
  const question = await Question.findById(id);
  if (!question) throw ApiError.notFound('Ikibazo ntikibonetse', 'QUESTION_NOT_FOUND');

  if (data.options) validateOptions(data.options);
  if (data.questionText) {
    if (data.questionText.trim().length < 4) throw ApiError.badRequest('Umwandiko w’ikibazo uri gato', 'EMPTY_QUESTION_TEXT');
    await assertNoDuplicate({
      questionNumber: data.questionNumber ?? question.questionNumber,
      questionText: data.questionText,
      excludeId: question._id,
    });
  } else if (data.questionNumber && data.questionNumber !== question.questionNumber) {
    await assertNoDuplicate({ questionNumber: data.questionNumber, questionText: question.questionText, excludeId: question._id });
  }

  const category = data.category !== undefined || data.categorySlug !== undefined ? await resolveCategory(data) : null;

  if (data.questionText !== undefined) question.questionText = data.questionText.trim();
  if (data.questionNumber !== undefined) question.questionNumber = data.questionNumber;
  if (category) {
    question.category = category._id;
    question.categorySlug = category.slug;
  }
  if (data.options !== undefined) {
    question.options = data.options.map((o, i) => ({
      id: o.id || String.fromCharCode(97 + i),
      label: o.label || String.fromCharCode(97 + i),
      text: o.text,
      isCorrect: Boolean(o.isCorrect),
    }));
  }
  if (data.explanation !== undefined) question.explanation = data.explanation || null;
  if (data.difficulty !== undefined) question.difficulty = data.difficulty;
  if (data.tags !== undefined) question.tags = data.tags;
  if (data.status !== undefined) question.status = data.status;
  if (data.image !== undefined) {
    question.image = data.image?.url ? { url: data.image.url, alt: data.image.alt || '' } : { url: null, alt: '' };
  }
  if (data.images !== undefined) {
    question.images = normalizeImages(data.images);
    if (data.image === undefined) {
      question.image = question.images[0]
        ? { url: question.images[0].url, alt: question.images[0].alt }
        : { url: null, alt: '' };
    }
  }
  question.updatedBy = user?._id || null;
  await question.save();
  await refreshCategoryCounts();
  return question;
}

export async function deleteQuestion(id) {
  const question = await Question.findById(id);
  if (!question) throw ApiError.notFound('Ikibazo ntikibonetse', 'QUESTION_NOT_FOUND');

  // If learners already answered it, keep the record (soft delete) so their
  // history and analytics stay intact.
  const used = await UserAnswer.exists({ question: id });
  if (used) {
    question.status = 'inactive';
    question.updatedBy = null;
    await question.save();
    await refreshCategoryCounts();
    return { question, soft: true };
  }

  await question.deleteOne();
  await Promise.all([Bookmark.deleteMany({ question: id }), refreshCategoryCounts()]);
  return { question, soft: false };
}

/**
 * Lists questions. Students only ever see published, examinable questions
 * unless the caller passes a staff context.
 */
export async function listQuestions({ query = {}, user = null, staff = false } = {}) {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 20, maxLimit: 100 });
  const filter = {};

  if (query.search) {
    const re = new RegExp(escapeRegex(String(query.search).trim()), 'i');
    filter.$or = [{ questionText: re }, { tags: re }, { questionNumber: Number.parseInt(query.search, 10) || -1 }];
  }
  if (query.category) {
    if (mongoose.isValidObjectId(query.category)) filter.category = new mongoose.Types.ObjectId(query.category);
    else filter.categorySlug = query.category;
  }
  if (query.difficulty && query.difficulty !== 'all') filter.difficulty = query.difficulty;
  if (query.hasImage === 'true') filter['images.0'] = { $exists: true };
  else if (query.hasImage === 'false') filter['images.0'] = { $exists: false };
  if (query.tag) filter.tags = query.tag;
  if (query.source) filter.source = query.source;

  if (staff) {
    if (query.status && query.status !== 'all') filter.status = query.status;
    if (query.review === 'true') filter.needsReview = true;
    if (query.examinable === 'true') filter.examinable = true;
  } else {
    filter.status = 'active';
  }

  if (query.bookmarked === 'true') {
    if (!user) throw ApiError.unauthorized();
    const bookmarks = await Bookmark.find({ user: user._id }).select('question').lean();
    filter._id = { $in: bookmarks.map((b) => b.question) };
  }

  let sort = { questionNumber: 1 };
  if (query.sort === 'recent') sort = { createdAt: -1 };
  if (query.sort === 'missed') sort = { 'stats.timesMissed': -1 };
  if (query.sort === 'hardest') sort = { 'stats.timesAnswered': -1 };

  const [items, total] = await Promise.all([
    Question.find(filter).populate('category', 'name slug color icon').sort(sort).skip(skip).limit(limit).lean(),
    Question.countDocuments(filter),
  ]);

  return {
    items: items.map((q) => toPublicQuestion(q, { includeCorrect: staff })),
    meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function getQuestion(id, { staff = false } = {}) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest('Indangamuntu ntariyo', 'INVALID_ID');
  const question = await Question.findById(id).populate('category', 'name slug color icon').lean();
  if (!question) throw ApiError.notFound('Ikibazo ntikibonetse', 'QUESTION_NOT_FOUND');
  if (!staff && question.status !== 'active') throw ApiError.notFound('Ikibazo ntikibonetse', 'QUESTION_NOT_FOUND');
  return toPublicQuestion(question, { includeCorrect: staff });
}

export function toPublicQuestion(q, { includeCorrect = false } = {}) {
  return {
    id: q._id,
    sourceId: q.sourceId || null,
    questionNumber: q.questionNumber,
    questionText: q.questionText,
    category: q.category
      ? { id: q.category._id || q.category, name: q.category.name, slug: q.category.slug, color: q.category.color, icon: q.category.icon }
      : null,
    image: q.image?.url ? q.image : null,
    images: (q.images || []).filter((i) => i.url).map((i) => ({ url: i.url, alt: i.alt || '', publicId: i.publicId || null })),
    options: (q.options || []).map((o) => ({
      id: o.id,
      label: o.label,
      text: o.text,
      ...(includeCorrect ? { isCorrect: Boolean(o.isCorrect) } : {}),
    })),
    correctOptionIds: includeCorrect ? (q.options || []).filter((o) => o.isCorrect).map((o) => o.id) : undefined,
    explanation: includeCorrect ? q.explanation || null : undefined,
    hasExplanation: Boolean(q.explanation),
    difficulty: q.difficulty,
    tags: q.tags || [],
    source: q.source,
    status: q.status,
    examinable: Boolean(q.examinable),
    needsReview: Boolean(q.needsReview),
    flags: q.flags || [],
    stats: q.stats || undefined,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
  };
}

export async function refreshCategoryCounts() {
  const counts = await Question.aggregate([{ $match: { status: 'active' } }, { $group: { _id: '$category', count: { $sum: 1 } } }]);
  const byId = new Map(counts.map((c) => [String(c._id), c.count]));
  const categories = await Category.find().select('_id');
  await Promise.all(
    categories.map((c) => Category.updateOne({ _id: c._id }, { $set: { questionCount: byId.get(String(c._id)) || 0 } })),
  );
}

export default {
  listQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  refreshCategoryCounts,
  validateOptions,
  computeExaminable,
  normalizeImages,
  toPublicQuestion,
};
