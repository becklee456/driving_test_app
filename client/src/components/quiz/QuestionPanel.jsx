import clsx from 'clsx';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { Badge } from '../ui/primitives.jsx';

function optionState({ optionId, selectedOptionId, revealed, correctIds }) {
  const isSelected = selectedOptionId === optionId;
  const isCorrect = correctIds?.includes(optionId);
  if (revealed) {
    if (isCorrect) return 'correct';
    if (isSelected && !isCorrect) return 'incorrect';
    return 'muted';
  }
  return isSelected ? 'selected' : 'idle';
}

const OPTION_CLASS = {
  idle: 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/40',
  selected: 'border-brand-500 bg-brand-50 ring-1 ring-brand-500',
  correct: 'border-emerald-500 bg-emerald-50',
  incorrect: 'border-rose-500 bg-rose-50',
  muted: 'border-slate-200 bg-white opacity-70',
};

const MARK_CLASS = {
  idle: 'border-slate-300 text-transparent',
  selected: 'border-brand-500 bg-brand-500 text-white',
  correct: 'border-emerald-500 bg-emerald-500 text-white',
  incorrect: 'border-rose-500 bg-rose-500 text-white',
  muted: 'border-slate-300 text-transparent',
};

export function QuestionPanel({
  question,
  selectedOptionId,
  onSelect,
  revealed = false,
  correctOptionIds = [],
  disabled = false,
  onToggleFlag,
  flagged = false,
  onReport,
  index,
  total,
}) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(null);
  if (!question) return null;
  const correctIds = revealed ? correctOptionIds : [];
  const isCorrect = revealed && correctOptionIds.includes(selectedOptionId);
  const images = question.images?.length ? question.images : question.image?.url ? [question.image] : [];

  return (
    <div className="card overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          {index != null && total != null ? (
            <Badge color="brand">{t('quiz.question_of', { current: index, total })}</Badge>
          ) : null}
          <Badge color="neutral">#{question.questionNumber}</Badge>
          {question.category?.name || question.category ? (
            <span className="text-xs font-medium text-slate-500">
              {question.category?.name || question.categoryName}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {onToggleFlag ? (
            <button
              type="button"
              onClick={onToggleFlag}
              className={clsx('rounded-lg p-1.5', flagged ? 'text-amber-500' : 'text-slate-400 hover:bg-slate-100')}
              title={flagged ? t('quiz.unflag') : t('quiz.flag')}
              aria-label={flagged ? t('quiz.unflag') : t('quiz.flag')}
            >
              <Icon name="flag" filled={flagged} className="h-5 w-5" />
            </button>
          ) : null}
          {onReport ? (
            <button
              type="button"
              onClick={onReport}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              title={t('quiz.report')}
              aria-label={t('quiz.report')}
            >
              <Icon name="alert" className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="px-4 py-5 sm:px-6">
        <p className="text-base font-semibold leading-relaxed text-slate-900 sm:text-lg">{question.questionText}</p>

        {images.length === 1 ? (
          <button
            type="button"
            onClick={() => setZoom(images[0])}
            className="mt-4 block w-full cursor-zoom-in"
            aria-label={t('quiz.zoom_image', { defaultValue: 'Zoom image' })}
          >
            <img src={images[0].url} alt={images[0].alt || ''} className="mx-auto max-h-72 w-auto object-contain" loading="lazy" />
          </button>
        ) : images.length > 1 ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-2">
            {images.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setZoom(img)}
                className="rounded-xl border border-slate-200 bg-white p-1 transition hover:border-brand-300 hover:bg-brand-50/40"
                aria-label={t('quiz.zoom_image', { defaultValue: 'Zoom image' })}
              >
                <img src={img.url} alt={img.alt || ''} className="mx-auto h-32 w-auto object-contain sm:h-40" loading="lazy" />
              </button>
            ))}
          </div>
        ) : null}

        <ul className="mt-5 flex flex-col gap-2.5" role={onSelect ? 'radiogroup' : undefined}>
          {question.options?.map((option) => {
            const state = optionState({ optionId: option.id, selectedOptionId, revealed, correctIds });
            const clickable = Boolean(onSelect) && !disabled && !revealed;
            return (
              <li key={option.id}>
                <button
                  type="button"
                  role={onSelect ? 'radio' : undefined}
                  aria-checked={selectedOptionId === option.id}
                  disabled={!clickable}
                  onClick={() => clickable && onSelect(option.id)}
                  className={clsx(
                    'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition',
                    OPTION_CLASS[state],
                    clickable && 'cursor-pointer',
                    !clickable && 'cursor-default',
                  )}
                >
                  <span
                    className={clsx(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold uppercase',
                      MARK_CLASS[state],
                    )}
                  >
                    {state === 'correct' || state === 'incorrect' ? (
                      <Icon name={state === 'correct' ? 'check' : 'x'} className="h-3.5 w-3.5" strokeWidth={3} />
                    ) : (
                      option.label || ''
                    )}
                  </span>
                  <span className="flex-1 text-sm text-slate-800 sm:text-base">{option.text}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {revealed ? (
          <div className="mt-5 space-y-3">
            <div
              className={clsx(
                'flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium',
                isCorrect ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800',
              )}
            >
              <Icon name={isCorrect ? 'check' : 'x'} className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={3} />
              <span>{isCorrect ? t('common.correct') : t('common.incorrect')}</span>
            </div>
            {question.explanation ? (
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('quiz.explanation')}</p>
                <p className="mt-1 text-sm text-slate-700">{question.explanation}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {zoom ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4"
          onClick={() => setZoom(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setZoom(null)}
            className="absolute right-4 top-4 rounded-lg bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label={t('common.close', { defaultValue: 'Close' })}
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
          <img
            src={zoom.url}
            alt={zoom.alt || ''}
            className="max-h-full max-w-full rounded-xl bg-white object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}

export default QuestionPanel;
