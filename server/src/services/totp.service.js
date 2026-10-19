import crypto from 'node:crypto';

/**
 * Minimal RFC 6238 (TOTP) / RFC 4226 (HOTP) implementation on top of node's
 * crypto, so no external dependency is required for admin 2FA.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input) {
  const clean = String(input).toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateSecret(length = 20) {
  return base32Encode(crypto.randomBytes(length));
}

function hotp(secret, counter, digits = 6) {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, '0');
}

export function totp(secret, { time = Date.now(), step = 30, digits = 6 } = {}) {
  return hotp(secret, Math.floor(time / 1000 / step), digits);
}

/** Verifies a token allowing +/- `window` steps of clock drift. */
export function verifyTotp(secret, token, { time = Date.now(), step = 30, digits = 6, window = 1 } = {}) {
  const candidate = String(token || '').replace(/\s+/g, '');
  if (!/^\d{6,8}$/.test(candidate)) return false;
  for (let i = -window; i <= window; i += 1) {
    const expected = totp(secret, { time: time + i * step * 1000, step, digits });
    if (expected.length === candidate.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(candidate))) {
      return true;
    }
  }
  return false;
}

export function otpauthUrl({ secret, label, issuer = 'Ikizamini cyo Gutwara' }) {
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: '30' });
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?${params.toString()}`;
}

export default { generateSecret, verifyTotp, totp, otpauthUrl, base32Encode, base32Decode };
