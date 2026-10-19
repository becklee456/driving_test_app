import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, Badge } from '../ui/primitives.jsx';
import { Button } from '../ui/form.jsx';
import { Ring, BarChart } from '../charts/index.jsx';
import { Icon } from '../icons.jsx';
import { QuestionPanel } from './QuestionPanel.jsx';
import { formatDuration } from '../../lib/format.js';

export function ResultPanel({ result, backTo = '/app', retakeTo }) {
  const { t } = useTranslation();
  const [showReview, setShowReview] = useState(false);
  const score = result?.score || {};
  const passed = score.passed;
  const isMock = result?.type === 'mock';

  const breakdown = (result?.breakdown || result?.score?.byCategory || []).map((b) => ({
    label: b.label || b.categoryName || b.name || b.slug || '—',
    value: b.total || b.count || 0,
  }));

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="flex flex-col items-center gap-5 px-5 py-8 text-center sm:flex-row sm:text-left">
          <Ring
            value={score.percentage || 0}
            size={120}
            stroke={12}
            color={passed ? '#10b981' : passed === false ? '#f43f5e' : '#1b6ff5'}
            sublabel={t('result.score')}
          />
          <div className="flex-1">
            <p className="text-xl font-bold text-slate-900">
              {isMock ? (passed ? t('result.passed') : t('result.failed')) : t('result.title')}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {t('result.correct_answers', { correct: score.correct || 0, total: score.total || 0 })}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Badge color="success">
                <span className="inline-flex items-center gap-1">
                  <Icon name="check" className="h-3.5 w-3.5" /> {score.correct || 0}
                </span>
              </Badge>
              <Badge color="danger">
                <span className="inline-flex items-center gap-1">
                  <Icon name="x" className="h-3.5 w-3.5" /> {score.incorrect || 0}
                </span>
              </Badge>
              <Badge color="neutral">{score.unanswered || 0} {t('common.unanswered').toLowerCase()}</Badge>
              {result?.durationSec ? (
                <Badge color="info">
                  <span className="inline-flex items-center gap-1">
                    <Icon name="clock" className="h-3.5 w-3.5" /> {formatDuration(result.durationSec)}
                  </span>
                </Badge>
              ) : null}
            </div>
            {isMock && score.passingScore != null ? (
              <p className="mt-3 text-xs text-slate-500">{t('result.passing_score', { score: score.passingScore })}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-4">
          <Link to={backTo} className="btn-secondary">
            {t('result.back_to_dashboard')}
          </Link>
          {retakeTo ? (
            <Link to={retakeTo} className="btn-primary">
              {t('result.retake')}
            </Link>
          ) : null}
          <Button variant="ghost" onClick={() => setShowReview((v) => !v)} className="ml-auto">
            {t('result.review')}
          </Button>
        </div>
      </Card>

      {breakdown.length ? (
        <Card>
          <div className="border-b border-slate-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-900">{t('result.by_category')}</h3>
          </div>
          <div className="px-5 py-5">
            <BarChart data={breakdown} height={140} />
          </div>
        </Card>
      ) : null}

      {showReview ? (
        <div className="space-y-4">
          {(result?.details || []).map((detail, i) => (
            <QuestionPanel
              key={detail.question?.id || i}
              index={i + 1}
              total={result.details.length}
              question={detail.question}
              selectedOptionId={detail.selectedOptionId}
              revealed
              correctOptionIds={detail.correctOptionIds}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default ResultPanel;
