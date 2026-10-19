import crypto from 'node:crypto';

export const randomToken = (bytes = 48) => crypto.randomBytes(bytes).toString('hex');

export const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

export const timingSafeEqual = (a, b) => {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

/** Cryptographically strong numeric OTP, e.g. "042913". */
export function generateOtp(length = 6) {
  let out = '';
  while (out.length < length) {
    out += String(crypto.randomInt(0, 10));
  }
  return out;
}

/** Deterministic, non-reversible short hash used for de-duplication. */
export function fingerprint(parts) {
  return sha256(parts.filter(Boolean).join('|')).slice(0, 32);
}
