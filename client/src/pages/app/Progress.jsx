import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProgress, useActivity, useResetProgress } from '../../hooks/useProgress.js';
import { Card, ProgressBar, Badge, Skeleton } from '../../components/ui/primitives.jsx';
import { Button } from '../../components/ui/form.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Ring, Heatmap, BarChart } from '../../components/charts/index.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { Icon } from '../../components/icons.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { formatDuration } from '../../lib/format.js';

export default function Progress() {
  const { t } = useTranslation();
  const toast = useToast();
  const { data: progress, isLoading } = useProgress();
  const { data: activity } = useActivity({ days: 126 });
  const reset = useResetProgress();
  const [confirm, setConfirm] = useState(false);

  if (isLoading) return <Skeleton className="h-96" />;

  const overview = progress?.overview || {};
  const coverage = progress?.coverage || {};
  const gamification = progress?.gamification || {};
  const categories = progress?.categories || [];
  const chartData = categories
    .filter((c) => c.answered > 0)
    .map((c) => ({ label: c.name, value: c.accuracy }));

  const onReset = async () => {
    try {
      await reset.mutateAsync();
      toast.success(t('common.deleted'));
      setConfirm(false);
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('progress.title')}
        action={
          <Button variant="ghost" onClick={() => setConfirm(true)}>
            <Icon name="refresh" className="h-4 w-4" /> {t('progress.reset')}
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('dashboard.accuracy')} value={`${overview.accuracy || 0}%`} icon={<Icon name="target" />} color="success" />
        <StatCard label={t('dashboard.tests_completed')} value={overview.testsCompleted || 0} icon={<Icon name="clipboard" />} />
        <StatCard label={t('dashboard.best_score')} value={`${overview.bestScore || 0}%`} icon={<Icon name="trophy" />} color="warning" />
        <StatCard label={t('dashboard.study_time')} value={formatDuration(overview.totalStudySeconds || 0)} icon={<Icon name="clock" />} color="info" />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col items-center justify-center gap-3 p-5 lg:col-span-1">
          <Ring value={coverage.coveragePercent || 0} size={130} stroke={12} sublabel={t('dashboard.coverage')} />
          <div className="grid w-full grid-cols-2 gap-2 text-center text-sm">
            <div className="rounded-xl bg-emerald-50 py-2">
              <p className="font-bold text-emerald-700">{coverage.mastered || 0}</p>
              <p className="text-xs text-emerald-600">{t('dashboard.mastered')}</p>
            </div>
            <div className="rounded-xl bg-rose-50 py-2">
              <p className="font-bold text-rose-700">{coverage.needsWork || 0}</p>
              <p className="text-xs text-rose-600">{t('dashboard.needs_work')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge color="info">{gamification.currentStreak || 0} 🔥</Badge>
            <Badge color="brand">{t('dashboard.level')} {gamification.level || 1}</Badge>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-900">{t('categories.accuracy')}</h3>
          {chartData.length ? (
            <div className="mt-4">
              <BarChart data={chartData} height={180} />
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">{t('common.no_data')}</p>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900">{t('progress.activity')}</h3>
        <div className="mt-4">
          <Heatmap data={activity || []} />
        </div>
      </Card>

      <Card>
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">{t('progress.by_category')}</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {categories.map((c) => (
            <div key={c.slug} className="flex items-center gap-4 px-4 py-3">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color || '#2563eb' }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{c.name}</p>
                <p className="text-xs text-slate-400">
                  {c.attempted || 0}/{c.totalQuestions || 0} · {t('categories.accuracy')} {c.accuracy || 0}%
                </p>
              </div>
              <div className="w-28 shrink-0">
                <ProgressBar value={c.coverage || 0} color={c.accuracy >= 80 ? 'success' : c.accuracy >= 50 ? 'warning' : 'danger'} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('progress.reset')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" loading={reset.isPending} onClick={onReset}>
              {t('common.confirm')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">{t('progress.reset_confirm')}</p>
      </Modal>
    </div>
  );
}
