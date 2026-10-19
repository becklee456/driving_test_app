import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeOptions,
  normalizeRecord,
  parseImportPayload,
  previewImport,
  commitImport,
} from '../src/services/import.service.js';
import { Question } from '../src/models/index.js';
import { createCategory } from './helpers/fixtures.js';

describe('import.service', () => {
  describe('normalizeOptions', () => {
    it('reads array options with an isCorrect flag', () => {
      const options = normalizeOptions({
        options: [
          { label: 'a', text: 'One', isCorrect: true },
          { label: 'b', text: 'Two' },
        ],
      });
      expect(options).toHaveLength(2);
      expect(options[0].isCorrect).toBe(true);
      expect(options[1].isCorrect).toBe(false);
    });

    it('reads object options with a correctAnswer marker', () => {
      const options = normalizeOptions({ options: { a: 'One', b: 'Two' }, correctAnswer: 'b' });
      expect(options.find((o) => o.label === 'b').isCorrect).toBe(true);
      expect(options.find((o) => o.label === 'a').isCorrect).toBe(false);
    });

    it('reads flat option columns', () => {
      const options = normalizeOptions({ optionA: 'One', optionB: 'Two', optionC: 'Three', correct: 'c' });
      expect(options).toHaveLength(3);
      expect(options.find((o) => o.label === 'c').isCorrect).toBe(true);
    });
  });

  describe('normalizeRecord', () => {
    it('maps alternative field names and splits tags', () => {
      const record = normalizeRecord({
        number: 7,
        question: 'Ikibazo?',
        options: { a: 'A', b: 'B' },
        answer: 'a',
        topic: 'speed',
        level: 'HARD',
        keywords: 'umuhanda, imodoka',
      });
      expect(record.questionNumber).toBe(7);
      expect(record.questionText).toBe('Ikibazo?');
      expect(record.category).toBe('speed');
      expect(record.difficulty).toBe('hard');
      expect(record.tags).toEqual(['umuhanda', 'imodoka']);
    });
  });

  describe('parseImportPayload', () => {
    it('parses a JSON array', () => {
      const payload = parseImportPayload({
        format: 'json',
        content: JSON.stringify([{ questionText: 'Q', options: { a: 'A', b: 'B' }, correctAnswer: 'a' }]),
      });
      expect(payload.kind).toBe('json');
      expect(payload.records).toHaveLength(1);
    });

    it('parses CSV with a header row', () => {
      const csv = 'questionNumber,questionText,optionA,optionB,correctAnswer\n1,Iki?,A,B,a\n';
      const payload = parseImportPayload({ format: 'csv', content: csv });
      expect(payload.records).toHaveLength(1);
      expect(payload.records[0].questionText).toBe('Iki?');
    });

    it('parses the official plain-text format', () => {
      const txt = '1. Ikibazo? a) A b) B (c) C';
      const payload = parseImportPayload({ format: 'txt', content: txt });
      expect(payload.kind).toBe('txt');
      expect(payload.records).toHaveLength(1);
      expect(payload.records[0].category).toBe('general-theory');
    });
  });

  describe('preview + commit', () => {
    beforeEach(async () => {
      await createCategory({ slug: 'general-theory', name: 'Igegenzura rusange' });
    });

    it('flags invalid and duplicate records during preview', async () => {
      const records = [
        normalizeRecord({ questionNumber: 1, questionText: 'Ikibazo kimwe?', options: { a: 'A', b: 'B' }, answer: 'a' }),
        normalizeRecord({ questionNumber: 2, questionText: 'Ikibazo kimwe?', options: { a: 'A', b: 'B' }, answer: 'a' }),
        normalizeRecord({ questionNumber: 3, questionText: 'Nta gisubizo?', options: { a: 'A', b: 'B' } }),
      ];
      const { results, summary } = await previewImport(records);
      expect(summary.total).toBe(3);
      expect(results[1].issues).toContain('duplicate-in-file');
      expect(results[2].issues).toContain('no-correct-answer');
      expect(results[0].importable).toBe(true);
    });

    it('imports valid records and keeps ambiguous ones for review', async () => {
      await Question.create({
        questionNumber: 99,
        questionText: 'Ikibazo gisanzweho?',
        options: [
          { id: 'a', label: 'a', text: 'A', isCorrect: true },
          { id: 'b', label: 'b', text: 'B', isCorrect: false },
        ],
        source: 'test',
      });

      const records = [
        normalizeRecord({ questionNumber: 1, questionText: 'Ikibazo gishya?', options: { a: 'A', b: 'B' }, answer: 'a' }),
        normalizeRecord({ questionNumber: 2, questionText: 'Ikibazo gisanzweho?', options: { a: 'A', b: 'B' }, answer: 'a' }),
        normalizeRecord({ questionNumber: 3, questionText: 'Ikibazo kitazwi?', options: { a: 'A', b: 'B' } }),
      ];
      const preview = await previewImport(records);
      expect(preview.results[1].issues).toContain('duplicate-in-database');

      const report = await commitImport(preview, { sourceName: 'test' });
      expect(report.imported).toBe(2);
      expect(report.skipped).toBe(1);

      const total = await Question.countDocuments();
      expect(total).toBe(3);
      const review = await Question.countDocuments({ status: 'review' });
      expect(review).toBe(1);
    });
  });
});
