import rateLimit from 'express-rate-limit';
import config from '../config/env.js';

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

/** Login attempts keyed by ip + email so one account cannot be brute-forced. */
export const loginLimiter = makeLimiter({
  windowMs: config.rateLimit.authWindowMs,
  max: config.security.maxLoginAttempts * 3,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.email || '').toLowerCase()}`,
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
  keyGenerator: (req) => `${req.ip}:${String(req.body?.email || req.user?.email || '').toLowerCase()}`,
  message: 'Code yoherejwe kenshi. Tegereza gato.',
});

export default { globalLimiter, authLimiter, loginLimiter, writeLimiter, otpLimiter };
