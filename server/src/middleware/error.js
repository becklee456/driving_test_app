import ApiError from '../utils/api-error.js';
import logger from '../config/logger.js';
import config from '../config/env.js';

export function notFoundHandler(req, _res, next) {
  next(new ApiError(404, 'ROUTE_NOT_FOUND', `Nta murongo wabonetse: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(err, req, res, _next) {
  let error = err;

  if (error?.name === 'ValidationError' && error.errors) {
    const details = Object.values(error.errors).map((e) => ({ path: e.path, message: e.message }));
    error = new ApiError(422, 'VALIDATION_ERROR', 'Amakuru wakoze ntabwo yemewe', details);
  } else if (error?.name === 'CastError') {
    error = ApiError.badRequest('Indangamuntu itariyo', 'INVALID_ID');
  } else if (error?.code === 11000) {
    const field = Object.keys(error.keyValue || {})[0] || 'field';
    error = ApiError.conflict('Iyi mibare isanzweho', 'DUPLICATE', { field });
  } else if (!(error instanceof ApiError)) {
    error = new ApiError(
      error?.status || 500,
      error?.code || 'INTERNAL_ERROR',
      error?.message || 'Habaye ikibazo, gerageza nyuma',
      undefined,
      false,
    );
  }

  if (error.status >= 500) {
    logger.error('Unhandled request error', {
      method: req.method,
      url: req.originalUrl,
      message: err?.message,
      stack: config.isProduction ? undefined : err?.stack,
    });
  } else if (config.isDevelopment) {
    logger.debug('Request failed', { url: req.originalUrl, code: error.code, status: error.status });
  }

  const payload = {
    success: false,
    error: {
      code: error.code,
      message: error.expose ? error.message : 'Habaye ikibazo kuri seriveri. Gerageza nyuma.',
    },
  };
  // Only expose structured details for intentional (exposed) errors - never
  // for wrapped internals that may embed stack/context information.
  if (error.details && error.expose) payload.error.details = error.details;
  if (config.isDevelopment && !error.expose) payload.error.debug = err?.message;

  res.status(error.status || 500).json(payload);
}

export function success(res, data, status = 200, meta) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

export default { notFoundHandler, errorHandler, success };
