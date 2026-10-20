/**
 * Normalises a Rwandan mobile number into local `07XXXXXXXX` form and returns
 * a canonical international form when possible. Returns null when the input is
 * not a plausible Rwandan mobile number.
 *
 * Accepted shapes: 078xxxxxxx, 25078xxxxxxx, +25078xxxxxxx, 07x xxx xxxx, etc.
 */
export function normalizeRwandaPhone(input) {
  if (input === null || input === undefined) return null;
  let digits = String(input).replace(/[^\d+]/g, '');
  digits = digits.replace(/^\+/, '');

  if (digits.startsWith('00')) digits = digits.replace(/^00+/, '');
  if (digits.startsWith('250')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);

  if (!/^7[2389]\d{7}$/.test(digits)) return null;
  const local = `0${digits}`;
  return { local, e164: `+250${digits}`, msisdn: digits };
}

export function isValidRwandaPhone(input) {
  return Boolean(normalizeRwandaPhone(input));
}

/** Canonical `07XXXXXXXX` string, or the trimmed raw input when unrecognised. */
export function canonicalPhone(input) {
  const normalized = normalizeRwandaPhone(input);
  if (normalized) return normalized.local;
  return String(input || '').trim();
}

export default { normalizeRwandaPhone, isValidRwandaPhone, canonicalPhone };
