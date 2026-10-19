import ApiError from '../utils/api-error.js';
import { effectivePermissions, isAdminRole } from '../constants/permissions.js';

/** Requires the user to hold every listed permission. */
export function requirePermission(...permissions) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    const effective = effectivePermissions(req.user);
    const missing = permissions.filter((p) => !effective.includes(p));
    if (missing.length) {
      return next(ApiError.forbidden('Nta bwemererwa buhagije', 'INSUFFICIENT_PERMISSIONS', { missing }));
    }
    return next();
  };
}

/** Requires at least one of the listed permissions. */
export function requireAnyPermission(...permissions) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    const effective = effectivePermissions(req.user);
    if (!permissions.some((p) => effective.includes(p))) {
      return next(ApiError.forbidden('Nta bwemererwa buhagije', 'INSUFFICIENT_PERMISSIONS'));
    }
    return next();
  };
}

/** Role gate used for coarse checks; prefer permissions where possible. */
export function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    return next();
  };
}

/** Allows any staff member into the admin area. */
export function requireStaff(req, _res, next) {
  if (!req.user) return next(ApiError.unauthorized());
  if (!isAdminRole(req.user.role)) return next(ApiError.forbidden('Ntabwo uri umuyobozi'));
  return next();
}
