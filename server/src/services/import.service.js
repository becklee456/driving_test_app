import ApiError from '../utils/api-error.js';
import { Question, Category, AdminActivity } from '../models/index.js';
import { normalizeQuestionText, slugify } from '../utils/slug.js';
import { parseSource, CATEGORY_RULES } from './parser/source-parser.js';
import { csvToObjects, toCsv } from '../utils/csv.js';
import { computeExaminable } from './question.service.js';

const OPTION_KEYS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function pick(obj, ...keys) {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  const lower = {};
  for (const [k, v] of Object.entries(obj)) lower[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = v;
  for (const key of keys) {
    const v = lower[key.toLowerCase().replace(/[^a-z0-9]/g, '')];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

function normalizeMarker(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim().toLowerCase();
  if (!s) return null;
  const letter = s.replace(/[^a-h]/g, '');
  if (letter) return letter.slice(-1);
  return null;
}

/** Turns the many accepted option shapes into `[{ label, text, isCorrect }]`. */
export function normalizeOptions(record) {
  const raw = record.options;

  if (Array.isArray(raw)) {
    return raw.map((opt, i) => {
      const label = String(opt.label || opt.id || OPTION_KEYS[i] || i).toLowerCase().slice(0, 1);
      return {
        label,
        text: String(opt.text ?? opt.value ?? opt.answer ?? '').trim(),
        isCorrect: opt.isCorrect === true || opt.correct === true,
      };
    });
  }

  if (raw && typeof raw === 'object') {
    const marker = normalizeMarker(
      pick(record, 'correctAnswer', 'correct', 'answer', 'correctOption', 'solution'),
    );
    return Object.entries(raw).map(([key, value]) => ({
      label: key.toLowerCase().slice(0, 1),
      text: String(typeof value === 'object' ? value.text ?? '' : value).trim(),
      isCorrect: marker ? key.toLowerCase().slice(0, 1) === marker : false,
    }));
  }

  // Options given as flat columns: optionA, optionB, ... plus correctAnswer.
  const marker = normalizeMarker(pick(record, 'correctanswer', 'correct', 'answer', 'correctoption'));
  const flat = [];
  for (const key of OPTION_KEYS) {
    const value = pick(record, `option${key}`, `opt${key}`, key);
    if (value !== undefined) flat.push({ label: key, text: String(value).trim(), isCorrect: key === marker });
  }
  return flat;
}

/** Maps an arbitrary import record onto the canonical question shape. */
export function normalizeRecord(record, { source = 'import' } = {}) {
  const options = normalizeOptions(record).filter((o) => o.label);
  const seen = new Set();
  for (const opt of options) {
    if (seen.has(opt.label)) {
      let n = 0;
      while (seen.has(OPTION_KEYS[n])) n += 1;
      opt.label = OPTION_KEYS[n] || opt.label;
    }
    seen.add(opt.label);
  }

  const tagsRaw = pick(record, 'tags', 'keywords');
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw.map((t) => String(t).trim()).filter(Boolean)
    : String(tagsRaw || '')
        .split(/[,;|]/)
        .map((t) => t.trim())
        .filter(Boolean);

  return {
    questionNumber: Number.isFinite(Number(pick(record, 'questionNumber', 'number', 'no')))
      ? Number(pick(record, 'questionNumber', 'number', 'no'))
      : null,
    questionText: String(pick(record, 'questionText', 'question', 'text', 'title') || '').trim(),
    options: options.map((o) => ({ label: o.label, text: o.text, isCorrect: o.isCorrect })),
    explanation: String(pick(record, 'explanation', 'rationale', 'note') || '').trim() || null,
    category: String(pick(record, 'category', 'categorySlug', 'topic') || '').trim() || null,
    difficulty: String(pick(record, 'difficulty', 'level') || 'medium').trim().toLowerCase() || 'medium',
    tags,
    image: pick(record, 'image', 'imageUrl') || null,
    source,
    sourceId: String(pick(record, 'sourceId', 'code') || '') || null,
    flags: Array.isArray(record.flags) ? record.flags : [],
  };
}

/** Filters a normalized record down to what the Question model accepts. */
function validateRecord(record) {
  const issues = [];
  if (!record.questionText || record.questionText.length < 4) issues.push('empty-question-text');
  if (record.options.length < 2) issues.push('too-few-options');
  const filled = record.options.filter((o) => o.text);
  if (filled.length < 2) issues.push('missing-option-text');
  const correct = record.options.filter((o) => o.isCorrect);
  if (correct.length === 0) issues.push('no-correct-answer');
  if (correct.length > 1) issues.push('multiple-correct-answers');
  if (record.difficulty && !['easy', 'medium', 'hard'].includes(record.difficulty)) issues.push('bad-difficulty');
  return issues;
}

export function parseImportPayload({ format, content, fileName = '' }) {
  const kind = (format || inferFormat(fileName)).toLowerCase();

  if (kind === 'json') {
    let data;
    try {
      data = typeof content === 'string' ? JSON.parse(content) : content;
    } catch {
      throw ApiError.badRequest('Dosiye ya JSON ntiboneye (JSON ya amakosa)', 'INVALID_JSON');
    }
    const list = Array.isArray(data) ? data : Array.isArray(data?.questions) ? data.questions : null;
    if (!list) throw ApiError.badRequest('JSON igomba kuba urutonde rw’ibibazo', 'INVALID_JSON_SHAPE');
    return { kind, records: list.map((r, i) => normalizeRecord(r, { index: i })), meta: { count: list.length } };
  }

  if (kind === 'csv') {
    const objects = csvToObjects(content);
    if (!objects.length) throw ApiError.badRequest('CSV irimo ubusa', 'EMPTY_CSV');
    return { kind, records: objects.map((r, i) => normalizeRecord(r, { index: i })), meta: { count: objects.length } };
  }

  // Official source document (plain text) — same parser the CLI uses.
  const { questions, counts } = parseSource(String(content));
  const records = questions.map((q) =>
    normalizeRecord(
      {
        questionNumber: q.questionNumber,
        questionText: q.questionText,
        options: (q.options || []).map((o) => ({ label: o.label, text: o.text, isCorrect: o.isCorrect })),
        explanation: q.explanation,
        category: q.categorySlug || q.category,
        difficulty: q.difficulty,
        tags: q.tags,
        flags: q.flags,
        sourceId: q.id || (q.questionNumber ? `doc-${q.questionNumber}-${q.order}` : null),
      },
      { index: q.order, source: 'official-document' },
    ),
  );
  return { kind: 'txt', records, meta: { count: records.length, sourceCounts: counts } };
}

export function inferFormat(fileName = '') {
  const ext = String(fileName).split('.').pop()?.toLowerCase();
  if (ext === 'json') return 'json';
  if (ext === 'csv') return 'csv';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  return 'txt';
}

/** Reads an .xlsx buffer into import records (first worksheet). */
export async function parseExcelBuffer(buffer) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw ApiError.badRequest('Excel ntirimo urupapuro', 'EMPTY_WORKBOOK');

  const header = [];
  sheet.getRow(1).eachCell((cell, col) => {
    header[col] = String(cell.value ?? '').toLowerCase().replace(/[\s_-]+/g, '');
  });

  const objects = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj = {};
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const key = header[col];
      if (!key) return;
      let value = cell.value;
      if (value && typeof value === 'object') value = value.text ?? value.result ?? value.hyperlink ?? '';
      obj[key] = value === null || value === undefined ? '' : String(value).trim();
    });
    if (Object.values(obj).some((v) => v !== '')) objects.push(obj);
  });

  return { kind: 'xlsx', records: objects.map((r, i) => normalizeRecord(r, { index: i })), meta: { count: objects.length } };
}

/**
 * Validates records and checks for duplicates, both inside the payload and
 * against what is already in the database. Nothing is written here.
 */
export async function previewImport(records, { sourceName = 'import' } = {}) {
  const seenText = new Map();
  const seenNumber = new Map();
  const normalizedTexts = records.map((r) => normalizeQuestionText(r.questionText));
  const numbers = [...new Set(records.map((r) => r.questionNumber).filter(Boolean))];

  const existingByText = normalizedTexts.length
    ? await Question.find({ normalizedText: { $in: normalizedTexts.filter(Boolean) } }).select('normalizedText questionNumber').lean()
    : [];
  const existingByNumber = numbers.length ? await Question.find({ questionNumber: { $in: numbers } }).select('questionNumber').lean() : [];
  const dbTexts = new Set(existingByText.map((q) => q.normalizedText));
  const dbNumbers = new Set(existingByNumber.map((q) => q.questionNumber));

  const results = records.map((record, index) => {
    const issues = [...(record.flags || []), ...validateRecord(record)];
    const text = normalizedTexts[index];

    if (text && seenText.has(text)) issues.push('duplicate-in-file');
    else if (text) seenText.set(text, index);

    if (record.questionNumber) {
      if (seenNumber.has(record.questionNumber)) issues.push('duplicate-number-in-file');
      else seenNumber.set(record.questionNumber, index);
    }

    if (text && dbTexts.has(text)) issues.push('duplicate-in-database');
    if (record.questionNumber && dbNumbers.has(record.questionNumber)) issues.push('number-exists-in-database');

    const blocking = issues.filter((i) =>
      ['empty-question-text', 'too-few-options', 'missing-option-text', 'duplicate-in-database', 'duplicate-in-file'].includes(i),
    );

    return {
      index,
      questionNumber: record.questionNumber,
      questionText: record.questionText.slice(0, 160),
      issues: [...new Set(issues)],
      importable: blocking.length === 0,
      examinable: computeExaminable(record.options),
      record,
    };
  });

  const summary = {
    total: results.length,
    importable: results.filter((r) => r.importable).length,
    blocked: results.filter((r) => !r.importable).length,
    needsReview: results.filter((r) => !r.examinable || (r.issues.length && r.importable)).length,
    withIssues: results.filter((r) => r.issues.length).length,
    sourceName,
  };

  return { results, summary };
}

async function ensureCategory(labelOrSlug, cache) {
  if (!labelOrSlug) return null;
  const needle = String(labelOrSlug).trim();
  const slug = slugify(needle);
  if (cache.has(slug)) return cache.get(slug);

  let category = await Category.findOne({ slug });
  if (!category) {
    const rule = CATEGORY_RULES?.find((r) => r.slug === slug || slugify(r.label) === slug);
    category = await Category.create({
      name: rule?.label || needle,
      slug,
      description: '',
      order: cache.size,
    });
  }
  cache.set(slug, category);
  return category;
}

/**
 * Writes the previewed records. Non-importable records are skipped and
 * reported; ambiguities are kept as `status: 'review'` rather than guessed.
 */
export async function commitImport(preview, { user, sourceName = 'import', dataset = null, skipDuplicateNumbers = true } = {}) {
  const categoryCache = new Map();
  const inserted = [];
  const skipped = [];
  const warnings = [];

  for (const item of preview.results) {
    if (!item.importable) {
      skipped.push({ index: item.index, questionNumber: item.questionNumber, issues: item.issues });
      continue;
    }
    if (skipDuplicateNumbers && item.issues.includes('number-exists-in-database')) {
      skipped.push({ index: item.index, questionNumber: item.questionNumber, issues: item.issues });
      continue;
    }

    const record = item.record;
    const examinable = computeExaminable(record.options);
    const category = await ensureCategory(record.category, categoryCache);
    const status = examinable ? 'active' : 'review';

    try {
      const doc = await Question.create({
        sourceId: record.sourceId || null,
        questionNumber: record.questionNumber,
        questionText: record.questionText,
        normalizedText: normalizeQuestionText(record.questionText),
        category: category?._id || null,
        categorySlug: category?.slug || null,
        options: record.options.map((o, i) => ({
          id: o.label || OPTION_KEYS[i],
          label: o.label || OPTION_KEYS[i],
          text: o.text,
          isCorrect: Boolean(o.isCorrect),
        })),
        explanation: record.explanation,
        difficulty: record.difficulty || 'medium',
        tags: record.tags,
        image: record.image ? { url: record.image, alt: '' } : { url: null, alt: '' },
        source: record.source || sourceName,
        status,
        flags: item.issues,
        needsReview: !examinable || item.issues.length > 0,
        createdBy: user?._id || null,
        updatedBy: user?._id || null,
      });
      inserted.push(doc._id);
    } catch (err) {
      if (err?.code === 11000) {
        skipped.push({ index: item.index, questionNumber: item.questionNumber, issues: [...item.issues, 'duplicate-key'] });
      } else {
        warnings.push({ index: item.index, questionNumber: item.questionNumber, message: err.message });
      }
    }
  }

  // Refresh denormalised category counters.
  const counts = await Question.aggregate([{ $match: { status: 'active' } }, { $group: { _id: '$category', count: { $sum: 1 } } }]);
  const byId = new Map(counts.map((c) => [String(c._id), c.count]));
  const categories = await Category.find().select('_id');
  await Promise.all(categories.map((c) => Category.updateOne({ _id: c._id }, { $set: { questionCount: byId.get(String(c._id)) || 0 } })));

  const report = {
    imported: inserted.length,
    skipped: skipped.length,
    warnings,
    skipDetails: skipped,
    total: preview.results.length,
    needsReview: preview.results.filter((r) => r.importable && !r.examinable).length,
    dataset: dataset || null,
    sourceName,
  };

  await AdminActivity.create({
    actor: user?._id || null,
    actorEmail: user?.email || null,
    actorRole: user?.role || null,
    action: 'import.completed',
    resource: 'question',
    resourceId: null,
    meta: { imported: report.imported, skipped: report.skipped, total: report.total, sourceName },
    result: 'success',
  }).catch(() => {});

  return report;
}

/** Full export of the question bank as JSON, CSV or XLSX rows. */
export async function exportQuestions({ filter = {}, format = 'json' } = {}) {
  const questions = await Question.find(filter).populate('category', 'name slug').sort({ questionNumber: 1 }).lean();
  const rows = questions.map((q) => {
    const row = {
      questionNumber: q.questionNumber ?? '',
      questionText: q.questionText,
      explanation: q.explanation || '',
      category: q.category?.slug || q.categorySlug || '',
      difficulty: q.difficulty,
      status: q.status,
      tags: (q.tags || []).join('; '),
      correctAnswer: (q.options.find((o) => o.isCorrect) || {}).label || '',
    };
    for (const key of OPTION_KEYS) {
      const opt = q.options.find((o) => String(o.label).toLowerCase() === key);
      row[`option${key.toUpperCase()}`] = opt?.text || '';
    }
    return row;
  });

  if (format === 'csv') {
    const columns = [
      'questionNumber',
      'questionText',
      ...OPTION_KEYS.map((k) => `option${k.toUpperCase()}`),
      'correctAnswer',
      'explanation',
      'category',
      'difficulty',
      'status',
      'tags',
    ];
    return { format: 'csv', body: toCsv(rows, columns), contentType: 'text/csv', filename: 'questions.csv' };
  }

  if (format === 'json') {
    return { format: 'json', body: JSON.stringify(rows, null, 2), contentType: 'application/json', filename: 'questions.json' };
  }

  throw ApiError.badRequest('Ubwoko bwa dosiye ntibwemewe', 'UNSUPPORTED_EXPORT_FORMAT');
}

export default {
  parseImportPayload,
  parseExcelBuffer,
  previewImport,
  commitImport,
  exportQuestions,
  normalizeRecord,
  normalizeOptions,
};
