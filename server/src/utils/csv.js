/**
 * Minimal RFC-4180 CSV parser: quoted fields, escaped quotes (""), CRLF and
 * embedded newlines. Returns rows as arrays of trimmed strings.
 */
export function parseCsv(input) {
  const text = String(input).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field.trim());
      field = '';
    } else if (char === '\n') {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field.trim());
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell !== ''));
}

/** Converts parsed CSV rows into objects keyed by the header row. */
export function csvToObjects(input) {
  const rows = parseCsv(input);
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.toLowerCase().replace(/[\s_-]+/g, ''));
  return rows.slice(1).map((cells) => {
    const obj = {};
    header.forEach((key, i) => {
      obj[key] = cells[i] ?? '';
    });
    return obj;
  });
}

export function toCsv(rows, columns) {
  const escape = (value) => {
    const s = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => escape(c)).join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => escape(row[c])).join(','));
  }
  return lines.join('\r\n');
}

export default { parseCsv, csvToObjects, toCsv };
