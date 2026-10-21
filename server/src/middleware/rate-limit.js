import rateLimit from 'express-rate-limit';
import config from '../config/env.js';

/**
 * IPv6-safe client IP key. Normalizes IPv4-mapped IPv6 addresses
 * (::ffff:1.2.3.4) and truncates IPv6 addresses to their /64 subnet so a
 * single client rotating interface ids cannot bypass per-IP limits.
 */
export function ipKeyGenerator(ip) {
  if (!ip) return 'unknown';
  const normalized = ip.toLowerCase().replace('::ffff:', '');
  if (normalized.includes(':')) {
    const groups = normalized.split(':');
    return `${groups.slice(0, 4).join(':')}::/64`;
  }
  return normalized;
}

const baseOptions = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Do not count successful requests that never reached the handler limits
  // differently - keep it simple and predictable.
  skip: (req) => req.method === 'OPTIONS',
};

function makeLimiter({ windowMs, max, message, keyGenerator, skipSuccessfulRequests }) {
  return rateLimit({
    ...baseOptions,
    windowMs,
    limit: max,
    skipSuccessfulRequests: Boolean(skipSuccessfulRequests),
    keyGenerator:
      keyGenerator ||
      ((req) => (req.user ? `user:${req.user._id}` : req.ip)),
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: message || 'Wakoze ibisabwa byinshi cyane. Gerageza nyuma gato.',
        },
      });
    },
  });
}

/** Broad limiter for the whole API surface. */
export const globalLimiter = makeLimiter({
  windowMs: config.rateLimit.globalWindowMs,
  max: config.rateLimit.globalMax,
  message: 'Ibisabwa byinshi cyane. Gerageza nyuma gato.',
});

/** Stricter limiter for authentication endpoints. */
export const authLimiter = makeLimiter({
  windowMs: config.rateLimit.authWindowMs,
  max: config.rateLimit.authMax,
  message: 'Kwinjira cyangwa kwiyandikisha byageragejwe kenshi. Tegereza gato.',
});

/**
 * Login attempts keyed by ip + email so one account cannot be brute-forced.
 * Successful logins are not counted (skipSuccessfulRequests), and the IP part
 * is normalized via the library's ipv6-safe helper.
 */
export const loginLimiter = makeLimiter({
  windowMs: config.rateLimit.authWindowMs,
  max: config.security.maxLoginAttempts * 3,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.email || '').toLowerCase()}`,
  message: 'Kwinjira byageragejwe kenshi kuri iyi konti. Tegereza gato.',
});

/** Write-heavy endpoints (quiz submit, reports, bookmarks...). */
export const writeLimiter = makeLimiter({
  windowMs: config.rateLimit.globalWindowMs,
  max: config.rateLimit.writeMax,
  message: 'Urakoze ibikorwa byinshi. Tegereza gato.',
});

/** OTP/resend endpoints: prevent email flooding. */
export const otpLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.email || req.user?.email || '').toLowerCase()}`,
  message: 'Code yoherejwe kenshi. Tegereza gato.',
});

export default { globalLimiter, authLimiter, loginLimiter, writeLimiter, otpLimiter };
