import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSource, findCandidates } from '../server/src/services/parser/source-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const raw = fs.readFileSync(path.join(ROOT, 'all_questions_with_answers.txt'), 'utf8').replace(/\r\n/g, '\n');

const { questions } = parseSource(raw);
const cands = findCandidates(raw);
const blockOf = (order) => {
  const c = cands[order - 1];
  const end = order < cands.length ? cands[order].idx : raw.length;
  return raw.slice(c.idx, end);
};

const mode = process.argv[2];
const count = Number(process.argv[3] || 8);

const pred = {
  nocorrect: (q) => q.options.length > 0 && q.options.filter((o) => o.isCorrect).length === 0,
  seq: (q) => q.flags.includes('unexpected-option-sequence'),
  many: (q) => q.options.length > 4,
  few: (q) => q.options.length < 4,
  multi: (q) => q.flags.includes('multiple-correct-answers-marked'),
  nopt: (q) => q.flags.includes('missing-option-text'),
  dup: (q) => q.flags.includes('duplicate-question-number'),
}[mode];

const hits = questions.filter(pred).slice(0, count);
for (const q of hits) {
  console.log('='.repeat(70));
  console.log(`order=${q.order} num=${q.questionNumber} flags=${q.flags.join(',')}`);
  console.log(JSON.stringify(blockOf(q.order)));
}
console.log('total matching:', questions.filter(pred).length);
