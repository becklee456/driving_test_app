/**
 * Application error with an HTTP status and a machine-readable code.
 * Messages are safe to expose to clients unless `expose` is false.
 */
export class ApiError extends Error {
  constructor(status, code, message, details = undefined, expose = true) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = expose;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message = 'Amakuru awakozwe ntabwo ari yo', code = 'BAD_REQUEST', details) {
    return new ApiError(400, code, message, details);
  }
  static unauthorized(message = 'Ugomba kwinjira mbere', code = 'UNAUTHORIZED', details) {
    return new ApiError(401, code, message, details);
  }
  static forbidden(message = 'Nta bwemererwa ufite', code = 'FORBIDDEN', details) {
    return new ApiError(403, code, message, details);
  }
  static notFound(message = 'Nta kintu kibonetse', code = 'NOT_FOUND', details) {
    return new ApiError(404, code, message, details);
  }
  static conflict(message = 'Iyi nkuru isanzweho', code = 'CONFLICT', details) {
    return new ApiError(409, code, message, details);
  }
  static tooMany(message = 'Wagerageje byinshi cyane. Tegereza gato.', code = 'RATE_LIMITED', details) {
    return new ApiError(429, code, message, details);
  }
  static locked(message = 'Konti yawe yafunzwe mu gihe gito', code = 'ACCOUNT_LOCKED', details) {
    return new ApiError(423, code, message, details);
  }
  static internal(message = 'Habaye ikibazo, gerageza nyuma', code = 'INTERNAL_ERROR', details) {
    return new ApiError(500, code, message, details, false);
  }
}

export default ApiError;
