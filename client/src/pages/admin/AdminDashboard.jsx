import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  useAdminOverview,
  useAdminGrowth,
  useAdminActivityTrend,
  useAdminCategoryPerformance,
  useAdminRecentActivity,
} from '../../hooks/useAdmin.js';
import { Card, Skeleton, Badge, ProgressBar, EmptyState } from '../../components/ui/primitives.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { Sparkline, BarChart } from '../../components/charts/index.jsx';
import { Icon } from '../../components/icons.jsx';
import { relativeTime } from '../../lib/format.js';

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { data: overview, isLoading } = useAdminOverview();
  const { data: growth } = useAdminGrowth({ days: 30 });
  const { data: trend } = useAdminActivityTrend({ days: 30 });
  const { data: categories } = useAdminCategoryPerformance();
  const { data: activity } = useAdminRecentActivity({ limit: 12 });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const users = overview?.users || {};
  const questions = overview?.questions || {};
  const engagement = overview?.engagement || {};

  const growthSeries = (growth || []).map((d) => d.count || 0);
  const trendSeries = (trend || []).map((d) => d.answered || 0);
  const categoryBars = (categories || []).slice(0, 10).map((c) => ({ label: c.name, value: c.answered }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">{t('admin.dashboard')}</h1>
        <div className="flex gap-2">
          <Link to="/admin/questions/new" className="btn-primary btn-sm">
            <Icon name="plus" className="h-4 w-4" /> {t('admin.new_question')}
          </Link>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('admin.total_questions')} value={questions.total || 0} hint={`${questions.active || 0} ${t('admin.active_questions')}`} icon={<Icon name="clipboard" />} color="brand" />
        <StatCard label={t('admin.needs_review')} value={questions.needsReview || 0} hint={`${questions.inReview || 0} in review`} icon={<Icon name="alert" />} color="warning" />
        <StatCard label={t('admin.total_users')} value={users.total || 0} hint={`+${users.newThisWeek || 0} this week`} icon={<Icon name="user" />} color="success" />
        <StatCard label={t('admin.open_reports')} value={overview?.reports?.open || 0} icon={<Icon name="flag" />} color="danger" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">{t('admin.user_growth')}</h3>
            <Badge color="success">+{users.newThisMonth || 0}/mo</Badge>
          </div>
          <Sparkline data={growthSeries} height={70} className="mt-4" />
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">{t('admin.quizzes_taken')}</h3>
            <Badge color="brand">{engagement.quizzesSubmitted || 0}</Badge>
          </div>
          <Sparkline data={trendSeries} height={70} stroke="#10b981" className="mt-4" />
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('dashboard.accuracy')} value={`${engagement.accuracy || 0}%`} icon={<Icon name="target" />} />
        <StatCard label={t('result.score')} value={`${engagement.averageScore || 0}%`} icon={<Icon name="chart" />} />
        <StatCard label={t('result.passed')} value={`${engagement.passRate || 0}%`} icon={<Icon name="check" />} color="success" />
        <StatCard label={t('dashboard.study_time')} value={`${Math.round((engagement.averageDurationSec || 0) / 60)}m`} icon={<Icon name="clock" />} color="info" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">{t('categories.title')}</h3>
          {categoryBars.length ? (
            <div className="mt-4">
              <BarChart data={categoryBars} height={160} />
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">{t('common.no_data')}</p>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">{t('admin.activity')}</h3>
            <Link to="/admin/audit" className="text-xs font-medium text-brand-700 hover:underline">
              {t('admin.audit')} →
            </Link>
          </div>
          {activity?.length ? (
            <ul className="divide-y divide-slate-100">
              {activity.slice(0, 8).map((a) => (
                <li key={a._id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="rounded-lg bg-slate-100 p-1.5 text-slate-500">
                    <Icon name="dot" className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-700">{a.action}</p>
                    <p className="text-xs text-slate-400">
                      {a.actor?.fullName || a.actor?.email || 'system'} · {relativeTime(a.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={t('common.no_data')} />
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900">{t('categories.accuracy')}</h3>
        <div className="mt-4 space-y-3">
          {(categories || []).slice(0, 6).map((c) => (
            <div key={c.id || c.slug}>
              <div className="flex justify-between text-sm">
                <span className="font-medium text-slate-700">{c.name}</span>
                <span className="text-slate-500">{c.accuracy || 0}% · {c.answered || 0} answers</span>
              </div>
              <ProgressBar value={c.accuracy || 0} color={c.accuracy >= 80 ? 'success' : c.accuracy >= 50 ? 'warning' : 'danger'} className="mt-1" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
