/**
 * Pure grading logic - deliberately free of database access so it can be
 * unit-tested directly.
 */

/** @typedef {import('../models/question.model.js').Question} Question */

export function isAnswerCorrect(question, selectedOptionId) {
  if (!question || !selectedOptionId) return false;
  const option = question.options?.find((o) => o.id === selectedOptionId);
  return Boolean(option?.isCorrect);
}

export function correctOptionIds(question) {
  return (question?.options || []).filter((o) => o.isCorrect).map((o) => o.id);
}

/**
 * Grades a quiz.
 * @param {Array} questions - ordered question documents
 * @param {Record<string,string|null>} selections - questionId/optionId map
 * @param {{ passingScore?: number }} [options]
 */
export function gradeQuiz(questions, selections = {}, { passingScore = null } = {}) {
  const details = [];
  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;
  const byCategory = new Map();

  for (const question of questions) {
    const qid = String(question._id || question.id);
    const selected = selections[qid] ?? null;
    const answered = Boolean(selected);
    const isCorrect = answered && isAnswerCorrect(question, selected);

    if (!answered) unanswered += 1;
    else if (isCorrect) correct += 1;
    else incorrect += 1;

    details.push({
      question: qid,
      selectedOptionId: selected,
      correctOptionId: correctOptionIds(question)[0] || null,
      correctOptionIds: correctOptionIds(question),
      answered,
      correct: isCorrect,
    });

    const key = String(question.category?._id || question.category || question.categorySlug || 'unassigned');
    const label = question.category?.name || question.categorySlug || 'Unassigned';
    if (!byCategory.has(key)) byCategory.set(key, { category: key, label, total: 0, correct: 0, incorrect: 0 });
    const bucket = byCategory.get(key);
    bucket.total += 1;
    if (answered && isCorrect) bucket.correct += 1;
    else bucket.incorrect += 1;
  }

  const total = questions.length;
  const percentage = total ? Math.round((correct / total) * 100) : 0;
  const passed = passingScore === null || passingScore === undefined ? null : percentage >= passingScore;

  return {
    total,
    correct,
    incorrect,
    unanswered,
    percentage,
    passed,
    passingScore: passingScore ?? null,
    byCategory: [...byCategory.values()].map((b) => ({
      ...b,
      percentage: b.total ? Math.round((b.correct / b.total) * 100) : 0,
    })),
    details,
  };
}

/** Ranks categories from weakest to strongest (min 3 questions to be listed). */
export function rankCategories(byCategory = [], { minQuestions = 3 } = {}) {
  const list = byCategory.filter((c) => c.total >= minQuestions);
  return {
    weak: [...list].sort((a, b) => a.percentage - b.percentage).slice(0, 3),
    strong: [...list].sort((a, b) => b.percentage - a.percentage).slice(0, 3),
  };
}

export default { gradeQuiz, isAnswerCorrect, correctOptionIds, rankCategories };
