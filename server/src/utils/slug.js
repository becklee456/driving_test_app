export function slugify(value, fallback = 'item') {
  const slug = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

/** Normalises a Kinyarwanda sentence for duplicate detection. */
export function normalizeQuestionText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'àáâãäçèéêëìíîïñòóôõöùúûü]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
