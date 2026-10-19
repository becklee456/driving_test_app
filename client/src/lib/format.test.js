import { describe, expect, it } from 'vitest';
import { formatDuration, formatClock, initials, percent, pluralize } from './format.js';

describe('format helpers', () => {
  it('formats durations', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(125)).toBe('2m 5s');
    expect(formatDuration(3725)).toBe('1h 2m');
  });

  it('formats a clock', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(65)).toBe('01:05');
    expect(formatClock(600)).toBe('10:00');
  });

  it('derives initials', () => {
    expect(initials('Mugisha Jean Paul')).toBe('MJ');
    expect(initials('')).toBe('');
  });

  it('formats percentages', () => {
    expect(percent(80)).toBe('80%');
    expect(percent(12.5, 1)).toBe('12.5%');
    expect(percent(null)).toBe('0%');
  });

  it('pluralizes', () => {
    expect(pluralize(1, 'question')).toBe('1 question');
    expect(pluralize(3, 'question')).toBe('3 questions');
  });
});
