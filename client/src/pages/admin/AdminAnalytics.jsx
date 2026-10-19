import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  useAdminGrowth,
  useAdminActivityTrend,
  useAdminCategoryPerformance,
  useAdminQuestionInsights,
  useAdminLeaderboard,
} from '../../hooks/useAdmin.js';
import { Card, Skeleton, Badge, ProgressBar } from '../../components/ui/primitives.jsx';
import { LineChart } from '../../components/charts/index.jsx';
import { Tabs } from '../../components/ui/nav.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { useState } from 'react';

export default function AdminAnalytics() {
  const { t } = useTranslation();
  const [days, setDays] = useState(30);
  const { data: growth, isLoading: gLoading } = useAdminGrowth({ days });
  const { data: trend, isLoading: tLoading } = useAdminActivityTrend({ days });
  const { data: categories } = useAdminCategoryPerformance();
  const { data: insights } = useAdminQuestionInsights({ limit: 10 });
  const { data: leaderboard } = useAdminLeaderboard({ limit: 10 });

  const growthSeries = (growth || []).map((d) => ({ label: d.date, value: d.count ?? d.total ?? 0 }));
  const trendSeries = (trend || []).map((d) => ({ label: d.date, value: d.answered ?? 0 }));

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('admin.analytics')}
        action={
          <Tabs
            tabs={[
              { value: 7, label: '7d' },
              { value: 30, label: '30d' },
              { value: 90, label: '90d' },
            ]}
            value={days}
            onChange={setDays}
          />
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">{t('admin.user_growth')}</h3>
          {gLoading ? <Skeleton className="mt-4 h-40" /> : <LineChart data={growthSeries} height={160} className="mt-4" />}
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">{t('admin.answers')}</h3>
          {tLoading ? <Skeleton className="mt-4 h-40" /> : <LineChart data={trendSeries} stroke="#10b981" height={160} className="mt-4" />}
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900">{t('categories.accuracy')}</h3>
        {categories?.length ? (
          <div className="mt-4 space-y-3">
            {categories.map((c) => (
              <div key={c.id || c.slug}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-700">{c.name}</span>
                  <span className="text-slate-500">
                    {c.accuracy}% · {c.answered} {t('admin.answers')} · {c.learners} {t('admin.learners')}
                  </span>
                </div>
                <ProgressBar value={c.accuracy} color={c.accuracy >= 80 ? 'success' : c.accuracy >= 50 ? 'warning' : 'danger'} className="mt-1" />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400">{t('common.no_data')}</p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">{t('admin.hardest')}</h3>
          {insights?.hardest?.length ? (
            <ul className="mt-3 space-y-3">
              {insights.hardest.map((q) => (
                <li key={q.id}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <Link to={`/admin/questions/${q.id}`} className="truncate text-slate-700 hover:text-brand-700">
                      #{q.questionNumber}
                    </Link>
                    <span className="text-xs text-rose-500">{q.missRate}% miss</span>
                  </div>
                  <p className="truncate text-xs text-slate-400">{q.questionText}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-400">{t('common.no_data')}</p>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">{t('admin.most_reported')}</h3>
          {insights?.mostReported?.length ? (
            <ul className="mt-3 space-y-3">
              {insights.mostReported.map((q) => (
                <li key={q.id}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <Link to={`/admin/questions/${q.id}`} className="truncate text-slate-700 hover:text-brand-700">
                      #{q.questionNumber}
                    </Link>
                    <Badge color="warning">{q.reports}</Badge>
                  </div>
                  <p className="truncate text-xs text-slate-400">{q.questionText}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-400">{t('common.no_data')}</p>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">{t('admin.leaderboard')}</h3>
          {leaderboard?.length ? (
            <ul className="mt-3 space-y-2">
              {leaderboard.map((u) => (
                <li key={u.id} className="flex items-center gap-3 text-sm">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">{u.rank}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-700">{u.name || '—'}</span>
                  <span className="text-xs text-slate-400">{u.xp} XP</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-400">{t('common.no_data')}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
