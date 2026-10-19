import clsx from 'clsx';

export function QuestionNavigator({ questions = [], currentIndex = 0, answers = {}, flagged = new Set(), onJump }) {
  return (
    <div className="grid grid-cols-6 gap-2 sm:grid-cols-8" role="listbox" aria-label="Questions">
      {questions.map((q, i) => {
        const id = q.id || q._id;
        const answered = Boolean(answers[id]);
        const isCurrent = i === currentIndex;
        const isFlagged = flagged.has(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => onJump?.(i)}
            className={clsx(
              'relative flex h-9 items-center justify-center rounded-lg border text-xs font-semibold transition',
              isCurrent
                ? 'border-brand-600 bg-brand-600 text-white'
                : answered
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400',
            )}
            aria-current={isCurrent ? 'true' : undefined}
          >
            {i + 1}
            {isFlagged ? <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400" /> : null}
          </button>
        );
      })}
    </div>
  );
}

export default QuestionNavigator;
