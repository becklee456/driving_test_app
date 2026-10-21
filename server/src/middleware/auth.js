import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import ApiError from '../utils/api-error.js';
import { User } from '../models/index.js';

export const ACCESS_COOKIE = 'idt_access';
export const REFRESH_COOKIE = 'idt_refresh';
export const CSRF_HEADER = 'x-csrf-protection';

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      role: user.role,
      ver: user.emailVerified ? 1 : 0,
      tokenVersion: user.loginSecurity?.passwordChangedAt?.getTime() || 0,
    },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessTtl, issuer: 'rwanda-driving-test' },
  );
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.jwt.accessSecret, { issuer: 'rwanda-driving-test' });
  } catch {
    return null;
  }
}

function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7).trim();
  if (req.cookies?.[ACCESS_COOKIE]) return req.cookies[ACCESS_COOKIE];
  return null;
}

/**
 * Populates req.user when a valid access token is present. Never throws.
 * Enforces the same tokenVersion check as `authenticate` so password changes
 * immediately invalidate optional-auth sessions too.
 */
export async function authenticateOptional(req, _res, next) {
  try {
    const token = extractToken(req);
    if (!token) return next();
    const payload = verifyAccessToken(token);
    if (!payload) return next();
    const user = await User.findById(payload.sub);
    if (!user || user.status === 'suspended' || user.status === 'deactivated') return next();
    if (user.loginSecurity?.lockedUntil && user.loginSecurity.lockedUntil > new Date()) return next();
    if (payload.tokenVersion !== (user.loginSecurity?.passwordChangedAt?.getTime() || 0)) return next();
    req.user = user;
    req.auth = payload;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * CSRF guard for cookie-authenticated endpoints that sit outside `authenticate`
 * (e.g. /auth/refresh, /auth/logout). Rejects cookie-based state-changing
 * requests that do not carry the custom CSRF header.
 */
export function requireCsrfHeader(req, _res, next) {
  const usesCookie = !req.headers.authorization && Boolean(req.cookies?.[ACCESS_COOKIE] || req.cookies?.[REFRESH_COOKIE]);
  const isStateChanging = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (usesCookie && isStateChanging && req.headers[CSRF_HEADER] !== '1') {
    return next(ApiError.forbidden('Ubusabe budafite umutekano (CSRF)', 'CSRF_REQUIRED'));
  }
  return next();
}

/**
 * Requires a valid, active account. Also enforces the CSRF header for
 * cookie-authenticated, state-changing requests.
 */
export async function authenticate(req, _res, next) {
  const token = extractToken(req);
  if (!token) return next(ApiError.unauthorized());

  const payload = verifyAccessToken(token);
  if (!payload) return next(ApiError.unauthorized('Muzungu w’uburenganzira warangiye', 'TOKEN_EXPIRED'));

  const user = await User.findById(payload.sub);
  if (!user) return next(ApiError.unauthorized());
  if (user.status === 'suspended') return next(ApiError.forbidden('Konti yawe ifunzwe', 'ACCOUNT_SUSPENDED'));
  if (user.status === 'deactivated') return next(ApiError.forbidden('Konti yawe yarafunzwe', 'ACCOUNT_DEACTIVATED'));
  if (user.loginSecurity?.lockedUntil && user.loginSecurity.lockedUntil > new Date()) {
    return next(ApiError.locked());
  }
  if (payload.tokenVersion !== (user.loginSecurity?.passwordChangedAt?.getTime() || 0)) {
    return next(ApiError.unauthorized('Ugomba kongera kwinjira', 'TOKEN_REVOKED'));
  }

  const usesCookie = !req.headers.authorization && Boolean(req.cookies?.[ACCESS_COOKIE]);
  const isStateChanging = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (usesCookie && isStateChanging && req.headers[CSRF_HEADER] !== '1') {
    return next(ApiError.forbidden('Ubusabe budafite umutekano (CSRF)', 'CSRF_REQUIRED'));
  }

  req.user = user;
  req.auth = payload;
  return next();
}

/** Requires a verified email address (used for exams and account changes). */
export function requireVerifiedEmail(req, _res, next) {
  if (!req.user) return next(ApiError.unauthorized());
  if (!req.user.emailVerified) {
    return next(ApiError.forbidden('Emeza konti yawe mbere', 'EMAIL_NOT_VERIFIED'));
  }
  return next();
}

export function setAuthCookies(res, { accessToken, refreshToken }) {
  const base = {
    httpOnly: true,
    secure: config.cookies.secure,
    sameSite: config.cookies.sameSite,
    domain: config.cookies.domain,
    path: '/',
  };
  if (accessToken) {
    res.cookie(ACCESS_COOKIE, accessToken, { ...base, maxAge: 1000 * 60 * 60 });
  }
  if (refreshToken) {
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...base,
      path: '/api/auth',
      maxAge: config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000,
    });
  }
}

export function clearAuthCookies(res) {
  const base = { httpOnly: true, secure: config.cookies.secure, sameSite: config.cookies.sameSite, path: '/' };
  res.clearCookie(ACCESS_COOKIE, base);
  res.clearCookie(REFRESH_COOKIE, { ...base, path: '/api/auth' });
}
