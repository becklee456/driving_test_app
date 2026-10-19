import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  parseSource,
  findCandidates,
  findMarkers,
  guessCategory,
  lastWord,
  isMeasurementPrefix,
  tidy,
} from '../src/services/parser/source-parser.js';

const SAMPLE = [
  '1. Ikinyabiziga kigomba kugira iki? a) Umuyobozi b) Umuherekeza (c) Nta muntu',
  '2. Umuvuduko wemewe mu mujyi ni uwuhe? a) 40 km/h (b) 60 km/h c) 80 km/h',
  '3. Iki kibazo nta gisubizo cy’ukuri kirimo? a) A b) B c) C',
].join('\n');

describe('parser helpers', () => {
  it('tidy collapses whitespace', () => {
    expect(tidy('  a   b\n c ')).toBe('a b c');
  });

  it('lastWord and isMeasurementPrefix detect measurement prefixes', () => {
    expect(lastWord('Ubugari ni cm')).toBe('cm');
    expect(isMeasurementPrefix('Ubugari ni cm')).toBe(true);
    expect(isMeasurementPrefix('Ikibazo 1')).toBe(false);
  });

  it('findMarkers recognises "a)", "(b)" and "c." markers', () => {
    const markers = findMarkers('a) text (b) text c. text');
    expect(markers.map((m) => m.letter)).toEqual(['a', 'b', 'c']);
    expect(markers.map((m) => m.parenthesized)).toEqual([false, true, false]);
  });

  it('findCandidates skips numbers that follow measurement units', () => {
    const candidates = findCandidates('Ubugari ni cm 4. Ikibazo 5. Ikindi');
    expect(candidates.map((c) => c.n)).toEqual([5]);
  });

  it('guessCategory picks the strongest keyword match', () => {
    expect(guessCategory('Umuvuduko wemewe ku muhanda')).toBe('speed');
    expect(guessCategory('Nta jambo')).toBe('general-theory');
  });
});

describe('parseSource', () => {
  it('splits questions and marks the parenthesized option as correct', () => {
    const { questions } = parseSource(SAMPLE);
    expect(questions).toHaveLength(3);

    const [first, second, third] = questions;
    expect(first.questionNumber).toBe(1);
    expect(first.questionText).toBe('Ikinyabiziga kigomba kugira iki?');
    expect(first.options.map((o) => o.label)).toEqual(['a', 'b', 'c']);
    expect(first.options.filter((o) => o.isCorrect).map((o) => o.label)).toEqual(['c']);
    expect(first.scoreable).toBe(true);

    expect(second.options.filter((o) => o.isCorrect).map((o) => o.label)).toEqual(['b']);

    expect(third.options.some((o) => o.isCorrect)).toBe(false);
    expect(third.scoreable).toBe(false);
    expect(third.flags).toContain('no-correct-answer-marked');
  });

  it('parses the official document and reports the expected totals', () => {
    const file = fileURLToPath(new URL('../../all_questions_with_answers.txt', import.meta.url));
    const raw = fs.readFileSync(file, 'utf8');
    const { questions } = parseSource(raw);

    expect(questions).toHaveLength(404);

    const scoreable = questions.filter((q) => q.scoreable).length;
    expect(scoreable).toBe(347);

    const noCorrect = questions.filter((q) => q.flags.includes('no-correct-answer-marked')).length;
    expect(noCorrect).toBe(51);

    const multipleCorrect = questions.filter((q) => q.flags.includes('multiple-correct-answers-marked')).length;
    expect(multipleCorrect).toBe(1);

    for (const q of questions) {
      expect(q.questionNumber).toBeGreaterThan(0);
      expect(q.options.length).toBeGreaterThan(0);
    }
  });
});
