import fs from 'node:fs/promises';
import config from '../config/env.js';
import * as importService from '../services/import.service.js';
import * as questionService from '../services/question.service.js';
import { success } from '../middleware/error.js';
import { recordActivity } from '../middleware/audit.js';
import ApiError from '../utils/api-error.js';

async function loadRecords({ format, content, fileName, source }) {
  if (source === 'bundled-dataset') {
    const raw = await fs.readFile(config.questionsFile, 'utf8');
    const data = JSON.parse(raw);
    const records = data.questions.map((q, i) =>
      importService.normalizeRecord(
        {
          questionNumber: q.questionNumber,
          questionText: q.questionText,
          options: (q.options || []).map((o) => ({ label: o.label, text: o.text, isCorrect: o.isCorrect })),
          explanation: q.explanation,
          category: q.category,
          difficulty: q.difficulty,
          tags: q.tags,
          flags: q.flags,
          sourceId: q.id,
        },
        { index: i, source: 'official-document' },
      ),
    );
    return { kind: 'json', records, meta: { count: records.length, datasetVersion: data.exportedAt || null } };
  }

  if (!content) throw ApiError.badRequest('Nta makuru yoherejwe', 'NO_CONTENT');

  const kind = (format || importService.inferFormat(fileName)).toLowerCase();
  if (kind === 'xlsx' || kind === 'xls') {
    const base64 = String(content).includes(',') ? String(content).split(',').pop() : String(content);
    const buffer = Buffer.from(base64, 'base64');
    return importService.parseExcelBuffer(buffer);
  }
  return importService.parseImportPayload({ format: kind, content, fileName });
}

export async function preview(req, res) {
  const { records, meta } = await loadRecords(req.body);
  const sourceName = req.body.sourceName || req.body.fileName || 'import';
  const { results, summary } = await importService.previewImport(records, { sourceName });

  return success(res, {
    summary,
    meta,
    preview: results.slice(0, 200).map((r) => ({
      index: r.index,
      questionNumber: r.questionNumber,
      questionText: r.questionText,
      issues: r.issues,
      importable: r.importable,
      examinable: r.examinable,
      optionCount: r.record.options.length,
    })),
  });
}

export async function commit(req, res) {
  const { records, meta } = await loadRecords(req.body);
  const sourceName = req.body.sourceName || req.body.fileName || 'import';
  const { results, summary } = await importService.previewImport(records, { sourceName });

  const report = await importService.commitImport(
    { results, summary },
    {
      user: req.user,
      sourceName,
      dataset: req.body.dataset || meta?.datasetVersion || null,
      skipDuplicateNumbers: req.body.skipDuplicateNumbers !== false,
    },
  );

  await questionService.refreshCategoryCounts();
  await recordActivity(req, {
    action: 'import.commit',
    resource: 'question',
    meta: { imported: report.imported, skipped: report.skipped, sourceName },
  });
  return success(res, { report }, 201);
}

export async function exportQuestions(req, res) {
  const format = req.query.format || 'csv';
  const filter = {};
  if (req.query.category) filter.categorySlug = req.query.category;
  if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
  if (req.query.difficulty && req.query.difficulty !== 'all') filter.difficulty = req.query.difficulty;

  const result = await importService.exportQuestions({ filter, format });
  await recordActivity(req, { action: 'import.export', resource: 'question', meta: { format } });

  res.setHeader('Content-Type', `${result.contentType}; charset=utf-8`);
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  return res.send(result.body);
}

export default { preview, commit, exportQuestions };
