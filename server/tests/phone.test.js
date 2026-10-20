import { describe, it, expect } from 'vitest';
import { normalizeRwandaPhone, isValidRwandaPhone, canonicalPhone } from '../src/utils/phone.js';

describe('rwandan phone utils', () => {
  it('accepts local, international and spaced forms', () => {
    for (const input of ['0781234567', '781234567', '250781234567', '+250781234567', '078 123 4567', '00250781234567']) {
      expect(isValidRwandaPhone(input), input).toBe(true);
    }
  });

  it('normalises to local 07XXXXXXXX form', () => {
    expect(canonicalPhone('+250781234567')).toBe('0781234567');
    expect(canonicalPhone('078 123 4567')).toBe('0781234567');
    expect(canonicalPhone('250731234567')).toBe('0731234567');
  });

  it('rejects invalid numbers', () => {
    for (const input of ['12345', '078123456', '07812345678', 'hello', '', null, undefined]) {
      expect(isValidRwandaPhone(input), String(input)).toBe(false);
    }
  });

  it('returns trimmed raw input when unrecognised', () => {
    expect(normalizeRwandaPhone('abc')).toBeNull();
    expect(canonicalPhone('  abc  ')).toBe('abc');
  });
});
