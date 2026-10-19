import ApiError from '../utils/api-error.js';

/**
 * Validates request parts against zod schemas and replaces them with the
 * parsed (typed, stripped) values.
 *
 *   router.post('/', validate({ body: schema }), handler)
 */
export function validate(schemas = {}) {
  return (req, _res, next) => {
    try {
      for (const part of ['body', 'query', 'params']) {
        const schema = schemas[part];
        if (!schema) continue;
        const result = schema.safeParse(req[part]);
        if (!result.success) {
          const details = result.error.issues.map((issue) => ({
            path: issue.path.join('.') || part,
            message: issue.message,
            code: issue.code,
          }));
          throw new ApiError(422, 'VALIDATION_ERROR', 'Amakuru wakoze ntabwo yemewe', details);
        }
        if (part === 'query') {
          req.validatedQuery = result.data;
        } else {
          req[part] = result.data;
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export default validate;
