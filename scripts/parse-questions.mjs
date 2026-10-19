#!/usr/bin/env node
/**
 * Parses the official driving-theory source document into a validated
 * question dataset (see scripts/lib/parse-source.mjs for the rules).
 *
 * Outputs:
 *   data/questions.json       - parsed questions, ready to be seeded
 *   data/import-report.json   - statistics + issues (admin review queue)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSource, CATEGORY_RULES } from '../server/src/services/parser/source-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'all_questions_with_answers.txt');
const OUT_DIR = path.join(ROOT, 'data');

const raw = fs.readFileSync(SRC, 'utf8');
const { questions, counts } = parseSource(raw);

const categoryBySlug = Object.fromEntries(CATEGORY_RULES.map((c) => [c.slug, c.label]));

const output = questions.map((q) => ({
  id: `q${String(q.order).padStart(4, '0')}`,
  questionNumber: q.questionNumber,
  questionText: q.questionText,
  category: q.categorySlug,
  categoryLabel: categoryBySlug[q.categorySlug] || categoryBySlug['general-theory'],
  categoryAuto: q.categoryAuto,
  image: null,
  options: q.options.map((o) => ({
    id: o.id,
    label: o.label,
    text: o.text,
    isCorrect: o.isCorrect,
  })),
  explanation: null,
  difficulty: 'medium',
  tags: [],
  source: 'all_questions_with_answers.txt',
  status: q.scoreable ? 'active' : 'review',
  examinable: q.scoreable,
  flags: q.flags,
  needsReview: q.needsReview,
  order: q.order,
}));

const tally = (fn) =>
  output.reduce((acc, q) => {
    const k = fn(q);
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

const flagCounts = {};
for (const q of output) for (const f of q.flags) flagCounts[f] = (flagCounts[f] || 0) + 1;

const present = new Set(output.map((q) => q.questionNumber));
const maxNumber = Math.max(...present);
const missingNumbers = [];
for (let i = 1; i <= maxNumber; i += 1) if (!present.has(i)) missingNumbers.push(i);

const report = {
  generatedAt: new Date().toISOString(),
  sourceFile: 'all_questions_with_answers.txt',
  totalQuestions: output.length,
  validQuestions: output.filter((q) => q.status === 'active').length,
  needsReview: output.filter((q) => q.status === 'review').length,
  duplicateNumbers: [...counts.entries()]
    .filter(([, c]) => c > 1)
    .map(([number, occurrences]) => ({ number, occurrences })),
  numbering: {
    first: output[0]?.questionNumber,
    last: output[output.length - 1]?.questionNumber,
    missingNumbers,
  },
  optionCounts: tally((q) => String(q.options.length)),
  correctAnswerCounts: tally((q) => String(q.options.filter((o) => o.isCorrect).length)),
  categoryCounts: tally((q) => q.category),
  statusCounts: tally((q) => q.status),
  flagCounts,
  imageNeeded: output.filter((q) => q.flags.includes('image-needed')).length,
  issues: output
    .filter((q) => q.needsReview)
    .map((q) => ({
      order: q.order,
      questionNumber: q.questionNumber,
      flags: q.flags,
      question: q.questionText.slice(0, 100),
    })),
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'questions.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(OUT_DIR, 'import-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({ ...report, issues: `${report.issues.length} (see data/import-report.json)` }, null, 2));
