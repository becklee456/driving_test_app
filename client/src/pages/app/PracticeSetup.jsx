import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCategories } from '../../hooks/useCategories.js';
import { useStartQuiz } from '../../hooks/useQuiz.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, Skeleton } from '../../components/ui/primitives.jsx';
import { Button, Select } from '../../components/ui/form.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Icon } from '../../components/icons.jsx';

const COUNTS = [10, 20, 30, 50];

export default function PracticeSetup({ type = 'practice' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const { config } = useSettings();
  const toast = useToast();
  const { data: categories, isLoading } = useCategories();
  const startQuiz = useStartQuiz();

  const [count, setCount] = useState(config?.practiceDefaultCount || 20);
  const [selected, setSelected] = useState(() => (params.get('category') ? [params.get('category')] : []));
  const [difficulty, setDifficulty] = useState('all');
  const [feedbackMode, setFeedbackMode] = useState('immediate');

  const toggle = (slug) =>
    setSelected((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));

  const categoryIds = useMemo(() => {
    if (!categories) return [];
    return selected.map((slug) => categories.find((c) => c.slug === slug)?.id || categories.find((c) => c.slug === slug)?._id).filter(Boolean);
  }, [selected, categories]);

  const onStart = async () => {
    if (!isAuthenticated) {
      toast.info(t('errors.unauthorized'));
      navigate('/login');
      return;
    }
    try {
      const data = await startQuiz.mutateAsync({
        type,
        count,
        categories: categoryIds,
        difficulty,
        feedbackMode,
      });
      navigate(`/quiz/${data.quiz.id}`, { state: { questions: data.questions } });
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('practice.setup_title')} subtitle={t('practice.setup_subtitle')} />

      <Card className="space-y-6 p-5 sm:p-6">
        <div>
          <p className="label">{t('practice.count')}</p>
          <div className="flex flex-wrap gap-2">
            {COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCount(n)}
                className={
                  count === n
                    ? 'rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white'
                    : 'rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-brand-300'
                }
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="label mb-0">{t('practice.categories')}</p>
            {selected.length ? (
              <button type="button" onClick={() => setSelected([])} className="text-xs font-medium text-brand-700 hover:underline">
                {t('common.reset')}
              </button>
            ) : null}
          </div>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-11" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(categories || []).map((cat) => {
                const active = selected.includes(cat.slug);
                return (
                  <button
                    key={cat.slug}
                    type="button"
                    onClick={() => toggle(cat.slug)}
                    className={
                      active
                        ? 'flex items-center gap-2 rounded-xl border border-brand-500 bg-brand-50 px-3 py-2.5 text-left text-sm font-medium text-brand-700'
                        : 'flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-left text-sm text-slate-600 hover:border-brand-300'
                    }
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: cat.color || '#2563eb' }}
                    />
                    <span className="truncate">{cat.name}</span>
                    {active ? <Icon name="check" className="ml-auto h-4 w-4 shrink-0" /> : null}
                  </button>
                );
              })}
            </div>
          )}
          {!selected.length ? <p className="mt-2 text-xs text-slate-400">{t('common.all')}</p> : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select label={t('practice.difficulty')} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="all">{t('common.all')}</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </Select>
          <Select label={t('practice.feedback')} value={feedbackMode} onChange={(e) => setFeedbackMode(e.target.value)}>
            <option value="immediate">{t('practice.immediate')}</option>
            <option value="end">{t('practice.end')}</option>
          </Select>
        </div>

        <Button onClick={onStart} loading={startQuiz.isPending} className="w-full" size="lg">
          {t('practice.start')}
        </Button>
      </Card>
    </div>
  );
}
