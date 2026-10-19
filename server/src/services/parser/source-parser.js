/**
 * Source-document parser.
 *
 * Converts the official driving-theory text file into structured questions.
 * The wording and the marked correct answers of the source are preserved
 * exactly. Anything ambiguous is flagged for admin review, never guessed.
 */

export const MAX_QUESTION_NUMBER = 999;

/** Words that, when written right before a number, mean a measurement
 *  (e.g. "cm 4.", "m 500.", "birometero 30.") rather than a question start. */
const UNIT_WORD = /^(?:[ckdh]?m|toni|ibiro|metero|romero|litiro|litero|velomoteri|kilomita|senti|milimita)$/i;
const UNIT_SUFFIX = /(?:metero|romero|litero|toni)$/i;

const MARKER_RE =
  /\(\s*([a-z])\s*\)|(?<![A-Za-z0-9'’/.])([a-z])\s*\)|(?<![A-Za-z0-9'’/.])([a-z])\.(?=\s|[A-Z'’(]|$)/gi;

export function lastWord(text) {
  const m = text.match(/([A-Za-z'’]+)\s*$/);
  return m ? m[1] : '';
}

export function isMeasurementPrefix(text) {
  const word = lastWord(text);
  if (!word) return false;
  return UNIT_WORD.test(word) || UNIT_SUFFIX.test(word);
}

export function findCandidates(text) {
  // "12." / "12 ." style question numbers
  const reA = /(?<!\d)(\d{1,3})\s*\.(?=[^0-9])/g;
  // rare source quirk: the period is missing entirely, e.g. "ihoni 225Wegereye"
  const reB = /(?:^|\s)(\d{1,3})(?=[A-Z][a-z])/g;

  const found = [];
  for (const re of [reA, reB]) {
    const usesLeadingSpace = re === reB;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const n = Number(m[1]);
      const idx = usesLeadingSpace ? m.index + (m[0].length - m[1].length) : m.index;
      found.push({ n, idx });
    }
  }

  found.sort((a, b) => a.idx - b.idx || b.n - a.n);

  const out = [];
  let lastIdx = -1;
  for (const c of found) {
    if (c.idx === lastIdx) continue;
    lastIdx = c.idx;
    if (isMeasurementPrefix(text.slice(Math.max(0, c.idx - 40), c.idx))) continue;
    if (c.n < 1 || c.n > MAX_QUESTION_NUMBER) continue;
    out.push({ n: c.n, idx: c.idx });
  }
  return out;
}

export function findMarkers(text) {
  const out = [];
  MARKER_RE.lastIndex = 0;
  let m;
  while ((m = MARKER_RE.exec(text))) {
    const letter = (m[1] || m[2] || m[3]).toLowerCase();
    const parenthesized = Boolean(m[1]);
    const sep = m[1] || m[2] ? ')' : '.';
    out.push({ idx: m.index, end: m.index + m[0].length, letter, parenthesized, sep });
  }
  return out;
}

export const tidy = (s) => s.replace(/\s+/g, ' ').trim();

/* ---------------------------------------------------------------- *
 * Categories (admins can re-categorise at any time)
 * ---------------------------------------------------------------- */
export const CATEGORY_RULES = [
  {
    slug: 'traffic-signs',
    label: 'Ibimenyetso by’umuhanda',
    keywords: ['ibimenyetso', 'imenyetso', 'icyapa', 'ibyapa', 'kimenyetso', 'ibimenye', 'isign', 'gusigna'],
  },
  {
    slug: 'road-markings',
    label: 'Imigendere y’umuhanda',
    keywords: ['umurongo', 'imirongo', 'ucagaguye', 'udacagaguye', 'inkombe', 'ibisate', 'umugendere', 'inkwi', 'gucibwa ku muhanda'],
  },
  {
    slug: 'speed',
    label: 'Umuvuduko',
    keywords: ['umuvuduko', 'km ', ' km', 'velomoteri', 'gutera umuvuduko', 'vitesi'],
  },
  {
    slug: 'overtaking',
    label: 'Kunyuranaho',
    keywords: ['kunyuranaho', 'kunyura', 'unyuranaho', 'nyuranaho', 'gusubira inyuma'],
  },
  {
    slug: 'parking',
    label: 'Guhagarara no gupaka',
    keywords: ['guhagarara', 'guhagararwa', 'umwanya munini', 'umwanya muto', 'gupaka', 'guhirikwa'],
  },
  {
    slug: 'pedestrians',
    label: 'Abanyamaguru',
    keywords: ['abanyamaguru', 'abanyeshuri', 'urugendo rwa rente', 'abana banyura', 'banyura mu muhanda'],
  },
  {
    slug: 'intersections',
    label: 'Intobo n’ihetero',
    keywords: ['intobo', 'gukata', 'ihetero', 'ku mpandangira', 'kuvanga', 'isangano ry’umuhanda'],
  },
  {
    slug: 'vehicle-safety',
    label: 'Gukingira ibinyabiziga',
    keywords: ['ibimenyetso by’ihoni', 'inziga', 'feri', 'amatara', 'utugarurarumuri', 'ibikoresho', 'umukandara', 'kwinjira', 'gukingira', 'imodoka ishobora'],
  },
  {
    slug: 'vehicle-equipment',
    label: 'Ibyokugenzura ibinyabiziga',
    keywords: ['ihoni', 'igare', 'romoruki', 'moteri', 'imiteremo', 'uduhanagurakirahure', 'ibyapa cyerekana', 'uburebure bwa', 'ubugari bwa'],
  },
  {
    slug: 'driving-behaviour',
    label: 'Imyitwarire y’umuyobozi',
    keywords: ['umuyobozi', 'butumwa', 'kunywa', 'uburwayi', 'ubushobozi', 'ibitotsi', 'kwita'],
  },
  {
    slug: 'emergency-situations',
    label: 'Ibyago byihariye',
    keywords: ['ipanuka', 'ibyago', 'igihu', 'imvura', 'umuyaga', 'abarwayi', 'gutabara', 'ubutabazi', 'gukiza'],
  },
  {
    slug: 'road-rules',
    label: 'Amategeko y’umuhanda',
    keywords: ['amategeko', 'itegeko', 'inzira nyabagendwa', 'kugendera', 'uburebure', 'ubugari', 'uburemere', 'kigereranya'],
  },
  { slug: 'general-theory', label: 'Igegenzura rusange', keywords: [] },
];

export function guessCategory(text) {
  const t = text.toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const rule of CATEGORY_RULES) {
    if (rule.slug === 'general-theory') continue;
    let score = 0;
    for (const kw of rule.keywords) if (t.includes(kw)) score += kw.length;
    if (score > bestScore) {
      bestScore = score;
      best = rule;
    }
  }
  return best ? best.slug : 'general-theory';
}

const IMAGE_HINT =
  /\b(kimenyetso|icyapa|ibyapa|ishusha|foto)\s+(kiri|gisa|iri|kiri mu)\b|\biki kimenyetso\b|\biki cyapa\b|\bherekanwa n’ibimenyetso\b|\biki kimenyetso kiri\b/i;

const REVIEW_FLAGS = [
  'empty-question-text',
  'too-few-options',
  'no-correct-answer-marked',
  'multiple-correct-answers-marked',
  'missing-option-text',
  'duplicate-option-labels',
  'duplicate-question-number',
];

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/**
 * Parse the whole source document.
 * @returns {{questions: Array, report: Object}}
 */
export function parseSource(rawInput) {
  const raw = rawInput.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ');
  const candidates = findCandidates(raw);

  const blocks = candidates.map((c, i) => ({
    number: c.n,
    text: raw.slice(c.idx, i + 1 < candidates.length ? candidates[i + 1].idx : raw.length),
  }));

  const questions = [];
  let prevNumber = 0;

  blocks.forEach((block, blockIndex) => {
    let body = block.text;
    const number = block.number;
    const hadHeader = /^\s*IKINYARWANDA\s+/i.test(body);

    body = body.replace(/^\s*IKINYARWANDA\s+/i, '').replace(/^\s*\d{1,3}\s*\.\s*/, '');

    const markers = findMarkers(body);

    const record = {
      order: blockIndex + 1,
      questionNumber: number,
      questionText: '',
      options: [],
      flags: [],
      needsReview: false,
    };
    if (hadHeader) record.flags.push('source-header-removed');

    if (markers.length === 0) {
      record.questionText = tidy(body);
      record.flags.push('no-options-detected');
      record.needsReview = true;
      record.scoreable = false;
      record.categorySlug = 'general-theory';
      record.categoryAuto = false;
      questions.push(record);
      return;
    }

    const stem = body.slice(0, markers[0].idx);
    record.questionText = tidy(stem.replace(/^\s*\d{1,3}\s*\.\s*/, ''));

    markers.forEach((mk, i) => {
      const textEnd = i + 1 < markers.length ? markers[i + 1].idx : body.length;
      record.options.push({
        id: LETTERS[i],
        label: mk.letter,
        text: tidy(body.slice(mk.end, textEnd)),
        isCorrect: mk.parenthesized,
      });
    });

    const correctCount = record.options.filter((o) => o.isCorrect).length;
    const letters = record.options.map((o) => o.label);

    if (record.questionText.length < 4) record.flags.push('empty-question-text');
    if (record.options.length < 3) record.flags.push('too-few-options');
    if (record.options.length > 6) record.flags.push('too-many-options');
    if (correctCount === 0) record.flags.push('no-correct-answer-marked');
    if (correctCount > 1) record.flags.push('multiple-correct-answers-marked');
    if (record.options.some((o) => !o.text)) record.flags.push('missing-option-text');
    if (new Set(letters).size !== letters.length) record.flags.push('duplicate-option-labels');

    const expected = letters.map((l, i) => LETTERS[i]);
    if (letters.some((l, i) => l !== expected[i])) record.flags.push('unexpected-option-sequence');

    if (number <= prevNumber) record.flags.push('duplicate-or-out-of-sequence-number');
    else if (number > prevNumber + 1) record.flags.push('numbering-gap-before');

    if (IMAGE_HINT.test(record.questionText)) record.flags.push('image-needed');

    prevNumber = Math.max(prevNumber, number);

    record.needsReview = record.flags.some((f) => REVIEW_FLAGS.includes(f));
    // A question can only be used for scored quizzes when the source marks
    // exactly one correct answer and at least two options have text.
    record.scoreable =
      correctCount === 1 &&
      record.questionText.length >= 4 &&
      record.options.filter((o) => o.text).length >= 2;
    const all = `${record.questionText} ${record.options.map((o) => o.text).join(' ')}`;
    record.categorySlug = guessCategory(all);
    record.categoryAuto = true;

    questions.push(record);
  });

  /* duplicate numbering: every occurrence is flagged */
  const counts = new Map();
  for (const q of questions) counts.set(q.questionNumber, (counts.get(q.questionNumber) || 0) + 1);
  for (const q of questions) {
    if (counts.get(q.questionNumber) > 1 && !q.flags.includes('duplicate-question-number')) {
      q.flags.push('duplicate-question-number');
      q.needsReview = true;
    }
  }

  return { questions, counts };
}
