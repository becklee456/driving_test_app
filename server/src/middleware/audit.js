import mongoose from 'mongoose';
import { AdminActivity } from '../models/index.js';
import logger from '../config/logger.js';

export function clientIp(req) {
  return req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
}

/**
 * Records an administrative/security action. Never throws: a failing audit
 * write must not break the user-facing request, but is logged loudly.
 */
export async function recordActivity(req, { action, resource, resourceId, meta, result = 'success' }) {
  try {
    await AdminActivity.create({
      actor: req.user?._id || null,
      actorEmail: req.user?.email || meta?.email || null,
      actorRole: req.user?.role || null,
      action,
      resource: resource || null,
      resourceId: resourceId ? String(resourceId) : null,
      meta: meta || {},
      ip: clientIp(req),
      userAgent: req.headers?.['user-agent'] || null,
      result,
    });
  } catch (err) {
    logger.error('Failed to write audit log', { action, error: err.message });
  }
}

export function audit(action, { resource, resourceId, meta, result } = {}) {
  return (req, _res, next) => {
    req.audit = { action, resource, resourceId, meta, result };
    next();
  };
}

/** Route middleware that records an audit entry after a successful handler. */
export function auditAction(action, options = {}) {
  return async (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode < 400) {
        recordActivity(req, {
          action,
          resource: options.resource || req.baseUrl,
          resourceId: options.resourceId?.(req) || req.params?.id,
          meta: options.meta?.(req) || {},
        }).catch(() => {});
      }
    });
    next();
  };
}

export function isValidId(id) {
  return mongoose.isValidObjectId(id);
}

export default { recordActivity, auditAction, clientIp };
