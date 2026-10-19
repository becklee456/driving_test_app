import mongoose from 'mongoose';

/**
 * Normalises pagination query parameters and builds a consistent response.
 */
export function parsePagination(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export function paginated(items, total, { page, limit }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return {
    items,
    meta: {
      total,
      page,
      limit,
      pages,
      hasNext: page < pages,
      hasPrev: page > 1,
    },
  };
}

/** Escapes user input before it is used inside a RegExp. */
export function escapeRegex(input = '') {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Builds a Mongo `$or` regex filter that tolerates Kinyarwanda accents. */
export function textSearchFilter(search, fields) {
  const term = escapeRegex(String(search).trim());
  if (!term) return null;
  const re = new RegExp(term, 'i');
  return { $or: fields.map((f) => ({ [f]: re })) };
}

export function isValidObjectId(value) {
  return mongoose.isValidObjectId(value);
}
