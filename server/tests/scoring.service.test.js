import { describe, it, expect } from 'vitest';
import { gradeQuiz, isAnswerCorrect, correctOptionIds, rankCategories } from '../src/services/scoring.service.js';

const questions = [
  {
    _id: 'q1',
    category: { _id: 'c1', name: 'Speed' },
    options: [
      { id: 'a', isCorrect: false },
      { id: 'b', isCorrect: true },
    ],
  },
  {
    _id: 'q2',
    category: { _id: 'c1', name: 'Speed' },
    options: [
      { id: 'a', isCorrect: true },
      { id: 'b', isCorrect: false },
    ],
  },
];

describe('scoring.service', () => {
  it('isAnswerCorrect only accepts the marked option', () => {
    expect(isAnswerCorrect(questions[0], 'b')).toBe(true);
    expect(isAnswerCorrect(questions[0], 'a')).toBe(false);
    expect(isAnswerCorrect(questions[0], null)).toBe(false);
  });

  it('correctOptionIds returns marked ids', () => {
    expect(correctOptionIds(questions[1])).toEqual(['a']);
  });

  it('grades a quiz with correct, incorrect and unanswered', () => {
    const result = gradeQuiz(questions, { q1: 'b', q2: 'b' });
    expect(result.total).toBe(2);
    expect(result.correct).toBe(1);
    expect(result.incorrect).toBe(1);
    expect(result.unanswered).toBe(0);
    expect(result.percentage).toBe(50);
    expect(result.passed).toBeNull();
  });

  it('counts unanswered questions separately', () => {
    const result = gradeQuiz(questions, { q1: 'b' });
    expect(result.correct).toBe(1);
    expect(result.unanswered).toBe(1);
    expect(result.percentage).toBe(50);
  });

  it('computes pass/fail against the passing score', () => {
    expect(gradeQuiz(questions, { q1: 'b', q2: 'a' }, { passingScore: 80 }).passed).toBe(true);
    expect(gradeQuiz(questions, { q1: 'b', q2: 'b' }, { passingScore: 80 }).passed).toBe(false);
  });

  it('groups results by category', () => {
    const result = gradeQuiz(questions, { q1: 'b', q2: 'b' });
    expect(result.byCategory).toHaveLength(1);
    expect(result.byCategory[0]).toMatchObject({ total: 2, correct: 1, percentage: 50 });
  });

  it('rankCategories separates weak from strong', () => {
    const ranks = rankCategories([
      { total: 10, correct: 3, percentage: 30, label: 'weak' },
      { total: 10, correct: 9, percentage: 90, label: 'strong' },
    ]);
    expect(ranks.weak[0].label).toBe('weak');
    expect(ranks.strong[0].label).toBe('strong');
  });

  it('ignores categories below the minimum sample size', () => {
    const ranks = rankCategories([{ total: 1, correct: 0, percentage: 0, label: 'tiny' }]);
    expect(ranks.weak).toHaveLength(0);
  });
});
