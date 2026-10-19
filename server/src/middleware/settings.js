import { Settings } from '../models/index.js';
import ApiError from '../utils/api-error.js';
import { isAdminRole } from '../constants/permissions.js';

let cache = { value: null, at: 0 };
const TTL_MS = 30_000;

/** Loads platform settings once per request, caching for a short window. */
export async function loadSettings(req, _res, next) {
  try {
    if (!cache.value || Date.now() - cache.at > TTL_MS) {
      cache.value = await Settings.getSettings();
      cache.at = Date.now();
    }
    req.settings = cache.value;
    next();
  } catch (err) {
    next(err);
  }
}

export function invalidateSettingsCache() {
  cache = { value: null, at: 0 };
}

/**
 * Auth endpoints that must stay reachable during maintenance so existing
 * users (in particular admins) can sign in and keep their session alive.
 * Paths are absolute because the guard runs on the router mounted at /api.
 */
const MAINTENANCE_EXEMPT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/login/2fa',
  '/api/auth/refresh',
  '/api/auth/logout',
]);

/** Blocks writes from regular learners while the platform is under maintenance. */
export function maintenanceGuard(req, _res, next) {
  const settings = req.settings;
  if (!settings?.maintenanceMode) return next();
  const readOnly = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (readOnly || isAdminRole(req.user?.role)) return next();
  const path = req.originalUrl.split('?')[0].replace(/\/+$/, '');
  if (MAINTENANCE_EXEMPT_PATHS.has(path)) return next();
  return next(
    ApiError.forbidden(
      'Seriveri iri mu kubungabunga. Ongera ugerageze nyuma gato.',
      'MAINTENANCE_MODE',
    ),
  );
}

export default { loadSettings, maintenanceGuard, invalidateSettingsCache };
